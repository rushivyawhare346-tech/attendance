const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DB_FILE = path.join(__dirname, 'database.json');

// 🟢 Green API Credentials
const ID_INSTANCE = '710722705226';
const API_TOKEN = '4e9cdc52f51241c28edeaba952ed00424dc6d3bdf5a8457cbd';

// Helper Functions for Local JSON Database
const readData = () => {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ students: [], attendance: [] }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const writeData = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// 💬 Direct WhatsApp Function via Green API
const sendDirectWhatsApp = async (parentPhone, studentName, status, timeStr) => {
  if (!parentPhone || parentPhone === 'N/A') return;

  const cleanPhone = parentPhone.replace(/\D/g, '').slice(-10);
  const chatId = `91${cleanPhone}@c.us`;

  const messageText = `🎓 *AI Attendance Alert*\n\nDear Parent,\nYour child *${studentName}* is marked *${status}* today at *${timeStr}*.`;

  try {
    const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
    const response = await axios.post(url, {
      chatId: chatId,
      message: messageText
    });
    console.log('📱 Direct WhatsApp Message Sent Successfully!', response.data);
  } catch (err) {
    console.log('❌ WhatsApp Sending Error:', err.response ? err.response.data : err.message);
  }
};

// 1. Register Student API
app.post('/api/register', (req, res) => {
  const { name, rollNo, branch, year, division, parentEmail, parentPhone, photo } = req.body;

  if (!name || !rollNo || !parentPhone) {
    return res.json({ success: false, message: 'Please fill in Name, Roll No, and Parent Phone!' });
  }

  const db = readData();
  const existing = db.students.find((s) => s.rollNo === rollNo);

  if (existing) {
    return res.json({ success: false, message: 'Student with this Roll Number already exists!' });
  }

  db.students.push({
    name,
    rollNo,
    branch,
    year,
    division: division || 'A',
    parentEmail: parentEmail || 'N/A',
    parentPhone,
    photo
  });
  writeData(db);

  res.json({ success: true, message: 'Student Registered Successfully!' });
});

// 2. Mark Attendance API
app.post('/api/mark-attendance', (req, res) => {
  const db = readData();
  const todayDate = new Date().toISOString().split('T')[0];

  if (db.students.length === 0) {
    return res.json({ success: false, message: 'No registered students found! Please Register first.' });
  }

  const student = db.students[db.students.length - 1];

  const alreadyMarked = db.attendance.find((a) => a.rollNo === student.rollNo && a.date === todayDate);

  if (alreadyMarked) {
    return res.json({
      success: true,
      message: `${student.name} is already marked Present today!`,
      alreadyMarked: true,
      studentName: student.name,
      rollNo: student.rollNo,
      branch: student.branch,
      year: student.year,
      division: student.division,
      parentPhone: student.parentPhone
    });
  }

  const timeStr = new Date().toLocaleTimeString();
  db.attendance.push({
    rollNo: student.rollNo,
    name: student.name,
    branch: student.branch,
    year: student.year,
    division: student.division,
    parentEmail: student.parentEmail || 'N/A',
    parentPhone: student.parentPhone,
    date: todayDate,
    time: timeStr
  });
  writeData(db);

  // Send Direct WhatsApp Alert
  if (student.parentPhone) {
    sendDirectWhatsApp(student.parentPhone, student.name, 'PRESENT', timeStr);
  }

  res.json({
    success: true,
    message: `${student.name} marked Present! Direct WhatsApp sent to ${student.parentPhone}`,
    studentName: student.name,
    rollNo: student.rollNo,
    branch: student.branch,
    year: student.year,
    division: student.division,
    parentPhone: student.parentPhone
  });
});

// 3. Attendance List API
app.get('/api/attendance-list', (req, res) => {
  const db = readData();
  res.json({ success: true, data: db.attendance });
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});