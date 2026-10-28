# RuralCare – Centralized Medical Records Platform

🌐 Live Website: https://ruralcare-five.vercel.app/

RuralCare is a web-based healthcare platform designed to help patients and doctors manage medical information digitally. It centralizes medical records, appointments, prescriptions, and doctor–patient communication in one application, reducing reliance on paper-based records.

## Features
- Authentication: Patient and doctor registration and login.
- Patient Profiles: View and update personal information.
- Medical Records: Maintain and access symptoms, diagnoses, treatments, notes, and follow-up dates.
- Appointments: Manage patient appointments.
- Prescriptions: Create and access prescription information.
- Doctor–Patient Communication:** Exchange messages and maintain conversations.
- Voice Accessibility: Voice input and speech playback to make the application easier to use.
- Database Persistence: Store application data in MongoDB.

## Technology Stack

- Frontend: React.js, Vite, JavaScript, CSS
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: JSON Web Tokens (JWT)
- Password Security: bcryptjs
- API Communication: REST APIs and Axios

## Project Structure

```text
RuralCare/
├── client/                 # React frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express backend
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── package.json
└── README.md
```

The exact files and folders may vary depending on the current project version.

## Prerequisites

Install the following before running RuralCare locally:

- Node.js and npm
- MongoDB, running locally or available through a MongoDB connection URI
- Git (optional, for cloning the repository)

## Installation and Setup

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd RuralCare
```

If you already have the project folder, open a terminal in that folder instead.

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

Open another terminal in the project root, then run:

```bash
cd server
npm install
```

### 4. Configure environment variables

Create a `.env` file inside the `server` directory.

Example configuration:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ruralcare
JWT_SECRET=replace_with_a_secure_random_secret
CLIENT_URL=http://localhost:5173
```

Use your actual configuration values if they differ. Keep `.env` private and never commit secrets to the repository.

### 5. Start the backend

From the `server` directory, run:

```bash
npm run dev
```

The backend is expected to run at `http://localhost:5000` when configured with the port shown above.

### 6. Start the frontend

Open another terminal and run:

```bash
cd client
npm run dev
```

Open the local URL displayed by Vite, usually:

`http://localhost:5173`

Ensure MongoDB is running and the backend can connect to the configured database.

## Application Behavior

- Patients and doctors can register and log in using their respective accounts.
- The frontend communicates with the backend through REST API endpoints.
- Express handles requests, authentication, and application logic.
- Mongoose connects the backend to MongoDB for persistent data storage.
- Authentication middleware protects authorized routes and supports role-based access.
- Medical records and prescriptions can be accessed through the relevant application workflows.
- Doctor–patient messaging supports stored conversations.
- Voice input and speech playback provide additional accessibility support.

Access to medical information should be restricted to authorized users according to the application's implemented permissions.

## Database

RuralCare uses MongoDB to store application information. Mongoose models represent the main data entities, including:

- Users
- Medical Records
- Appointments
- Prescriptions
- Messages

The database connection is configured through the `MONGO_URI` environment variable. Start MongoDB and verify the connection before using database-dependent features.

## Verification

Run the following commands separately to check the frontend and backend scripts available in the project.

**Backend tests**

```bash
cd server
npm test
```

**Frontend linting**

```bash
cd client
npm run lint
```

**Frontend production build**

```bash
npm run build
```

These commands depend on the scripts defined in each `package.json`. If a script is not configured, add it or update the documentation to match the available scripts.

## Security and Data Integrity

- Passwords should be stored as secure hashes rather than plaintext.
- JWT secrets must be kept in environment variables.
- Protected routes should verify authentication and user permissions.
- Medical records and messages should only be accessible to authorized users.
- Environment files and sensitive patient data should not be committed to version control.

## Project Status

RuralCare is a local development project for demonstrating a centralized medical records platform. The application is intended to support healthcare information management and improve access to patient records.

