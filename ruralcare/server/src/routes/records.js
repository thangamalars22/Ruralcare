const router = require('express').Router();

const express = require('express');

const MedicalRecord = require('../models/MedicalRecord');

const { REPORT_TYPES } = MedicalRecord;

const { auth, requireRole } = require('../middleware/auth');

const { ah, bad, isLinked, str: shortStr } = require('../lib/helpers');

const storage = require('../lib/storage');



router.use(auth);



const OID = /^[a-f0-9]{24}$/i;

const POPULATE = ['doctor', 'name specialization'];



const LAB_TYPES = [

  'blood_sugar',

  'blood_pressure',

  'xray',

  'blood_test',

  'urine_test',

  'ecg',

  'imaging',

  'laboratory',

];



const legacyType = (type) =>

  LAB_TYPES.includes(type)

    ? 'lab'

    : type === 'other'

      ? 'other'

      : 'consultation';



const str = (value, max = 5000) =>

  typeof value === 'string'

    ? value.trim().slice(0, max) || undefined

    : undefined;



const num = (value, min, max) => {

  if (value === '' || value == null) return undefined;



  const number = Number(value);



  return Number.isFinite(number) && number >= min && number <= max

    ? number

    : NaN;

};



async function canAccess(user, record) {

  if (user.role === 'patient') {

    return String(record.patient) === String(user.id);

  }



  if (user.role === 'doctor') {

    return Boolean(await isLinked(user.id, record.patient));

  }



  return false;

}



// List records for the logged-in patient or doctor.

router.get('/', ah(async (req, res) => {

  if (req.user.role === 'patient') {

    const records = await MedicalRecord.find({

      patient: req.user.id,

    })

      .sort('-visitDate -createdAt')

      .populate(...POPULATE);



    return res.json(records);

  }



  if (req.user.role !== 'doctor') {

    return bad(res, 'You are not allowed to view medical records.', 403);

  }



  if (req.query.patient === undefined) {

    const records = await MedicalRecord.find({

      doctor: req.user.id,

    })

      .sort('-visitDate -createdAt')

      .limit(1000)

      .populate(...POPULATE)

      .populate('patient', 'name patientId');



    return res.json(records);

  }



  const patient = req.query.patient;



  if (typeof patient !== 'string' || !OID.test(patient)) {

    return bad(res, 'Patient is required.');

  }



  if (!(await isLinked(req.user.id, patient))) {

    return bad(res, 'You do not have access to this patient.', 403);

  }



  const records = await MedicalRecord.find({ patient })

    .sort('-visitDate -createdAt')

    .populate(...POPULATE);



  return res.json(records);

}));



// Validate and normalize medical-record details.

function readDetails(body) {

  if (typeof body.title !== 'string' || !body.title.trim()) {

    return { error: 'Please enter a report title.' };

  }



  const visit = new Date(body.visitDate);



  if (!body.visitDate || Number.isNaN(visit.getTime())) {

    return { error: 'Please enter the test date.' };

  }



  if (visit > new Date(Date.now() + 24 * 60 * 60 * 1000)) {

    return { error: 'The test date cannot be in the future.' };

  }



  const reportType = body.reportType || 'general';



  if (!REPORT_TYPES.includes(reportType)) {

    return { error: 'Please choose a valid report type.' };

  }



  const values =

    body.vitals && typeof body.vitals === 'object'

      ? body.vitals

      : {};



  const heartRate = num(values.heartRate, 20, 300);

  const weightKg = num(values.weightKg, 0.5, 500);

  const bloodSugar = num(values.bloodSugar, 10, 1500);



  if ([heartRate, weightKg, bloodSugar].some(Number.isNaN)) {

    return { error: 'Please check the measurements you entered.' };

  }



  const vitals = {};



  if (heartRate !== undefined) vitals.heartRate = heartRate;

  if (weightKg !== undefined) vitals.weightKg = weightKg;

  if (bloodSugar !== undefined) vitals.bloodSugar = bloodSugar;



  const bloodPressure = shortStr(values.bloodPressure, 20);

  if (bloodPressure) vitals.bloodPressure = bloodPressure;



  const followUp = body.followUpDate

    ? new Date(body.followUpDate)

    : undefined;



  return {

    data: {

      type: legacyType(reportType),

      reportType,

      title: body.title.trim().slice(0, 200),

      visitDate: visit,

      symptoms: str(body.symptoms),

      diagnosis: str(body.diagnosis),

      results: str(body.results),

      treatment: str(body.treatment),

      notes: str(body.notes),

      followUpDate:

        followUp && !Number.isNaN(followUp.getTime())

          ? followUp

          : undefined,

      vitals,

      healthStatus: ['good', 'attention', 'critical'].includes(

        body.healthStatus

      )

        ? body.healthStatus

        : undefined,

    },

  };

}



// Create a medical record.

router.post('/', requireRole('doctor'), ah(async (req, res) => {

  const body = req.body || {};



  if (typeof body.patient !== 'string' || !OID.test(body.patient)) {

    return bad(res, 'Patient is required.');

  }



  const { data, error } = readDetails(body);

  if (error) return bad(res, error);



  if (!(await isLinked(req.user.id, body.patient))) {

    return bad(res, 'You do not have access to this patient.', 403);

  }



  const record = await MedicalRecord.create({

    ...data,

    patient: body.patient,

    doctor: req.user.id,

  });



  return res.status(201).json(await record.populate(...POPULATE));

}));



// Update a record created by the logged-in doctor.

router.patch(

  '/:id',

  requireRole('doctor'),

  (req, res, next) =>

    OID.test(req.params.id)

      ? next()

      : bad(res, 'Record not found.', 404),

  ah(async (req, res) => {

    const record = await MedicalRecord.findById(req.params.id);



    if (!record || String(record.doctor) !== String(req.user.id)) {

      return bad(res, 'Record not found.', 404);

    }



    const { data, error } = readDetails(req.body || {});

    if (error) return bad(res, error);



    record.set(data);

    await record.save();



    return res.json(await record.populate(...POPULATE));

  })

);



// Attach or replace a report file.

router.put(

  '/:id/file',

  requireRole('doctor'),

  (req, res, next) =>

    OID.test(req.params.id)

      ? next()

      : bad(res, 'Record not found.', 404),

  express.raw({

    type: () => true,

    limit: storage.MAX_BYTES,

  }),

  ah(async (req, res) => {

    const record = await MedicalRecord.findById(req.params.id)

      .select('+file.storageKey');



    if (

      !record ||

      String(record.doctor) !== String(req.user.id)

    ) {

      return bad(res, 'Record not found.', 404);

    }



    const buffer = req.body;



    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {

      return bad(res, 'Please choose a file to upload.');

    }



    const mimeType = storage.detectType(buffer);



    if (!mimeType) {

      return bad(

        res,

        'Only PDF, JPG and PNG files are accepted.',

        415

      );

    }



    let originalName = 'report';



    try {

      originalName = decodeURIComponent(

        String(req.headers['x-file-name'] || 'report')

      );

    } catch {

      originalName = 'report';

    }



    originalName = originalName

      .replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '_')

      .slice(0, 150) || 'report';



    const oldKey = record.file?.storageKey;

    const storageKey = await storage.save(buffer, mimeType);



    record.file = {

      storageKey,

      originalName,

      mimeType,

      size: buffer.length,

      uploadedAt: new Date(),

    };



    try {

      await record.save();

    } catch (error) {

      await storage.remove(storageKey).catch(() => {});

      throw error;

    }



    if (oldKey && oldKey !== storageKey) {

      await storage.remove(oldKey).catch((error) => {

        console.error('Could not remove replaced report file:', error);

      });

    }



    const updatedRecord = await MedicalRecord.findById(record._id)

      .populate(...POPULATE);



    return res.json(updatedRecord);

  })

);



// View or download a report file.

router.get('/:id/file', ah(async (req, res) => {

  if (!OID.test(req.params.id)) {

    return bad(res, 'Report not found.', 404);

  }



  const record = await MedicalRecord.findById(req.params.id)

    .select('patient doctor file.originalName file.mimeType file.size +file.storageKey');



  if (!record || !(await canAccess(req.user, record))) {

    return bad(res, 'Report not found.', 404);

  }



  const storageKey = record.file?.storageKey;



  if (!storageKey) {

    return bad(res, 'No report file is attached.', 404);

  }



  try {

    const fileExists = await storage.exists(storageKey);



    if (!fileExists) {

      console.error('Report file missing from storage:', storageKey);

      return bad(

        res,

        'Report file is missing from server storage. Please upload it again.',

        404

      );

    }



    const fileStream = storage.stream(storageKey);



    if (!fileStream || typeof fileStream.pipe !== 'function') {

      return bad(res, 'Unable to open the report file.', 500);

    }



    fileStream.on('error', (error) => {

      console.error('Report file stream error:', error);



      if (!res.headersSent) {

        res.status(500).json({

          message: 'Unable to read the report file.',

        });

      } else {

        res.destroy(error);

      }

    });



    const disposition =

      req.query.download === '1' ? 'attachment' : 'inline';



    const safeName = String(record.file.originalName || 'report')

      .replace(/[\r\n]/g, '_');



    res.set({

      'Content-Type':

        record.file.mimeType || 'application/octet-stream',

      'Content-Disposition':

        `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,

      'Cache-Control': 'private, no-store',

      'X-Content-Type-Options': 'nosniff',

      'Content-Security-Policy': "default-src 'none'; sandbox",

    });



    if (Number.isFinite(record.file.size)) {

      res.set('Content-Length', String(record.file.size));

    }



    fileStream.pipe(res);

  } catch (error) {

    console.error('Medical report retrieval error:', error);



    if (!res.headersSent) {

      return bad(res, 'Unable to retrieve the report file.', 500);

    }



    res.destroy(error);

  }

}));



// Delete a record and its stored report file.

router.delete('/:id', requireRole('doctor'), ah(async (req, res) => {

  if (!OID.test(req.params.id)) {

    return bad(res, 'Record not found.', 404);

  }



  const record = await MedicalRecord.findById(req.params.id)

    .select('doctor +file.storageKey');



  if (

    !record ||

    String(record.doctor) !== String(req.user.id)

  ) {

    return bad(res, 'Record not found.', 404);

  }



  if (record.file?.storageKey) {

    await storage.remove(record.file.storageKey).catch((error) => {

      console.error('Could not remove report file:', error);

    });

  }



  await record.deleteOne();



  return res.json({ ok: true });

}));



module.exports = router;
