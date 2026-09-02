const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

const emailRegex = /^\S+@\S+\.\S+$/;

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    if (!emailRegex.test(email))
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ email: email.toLowerCase(), password });
    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: 'User created',
      token,
      user: { id: user._id, email: user.email, createdAt: user.createdAt }
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'Email already registered' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, createdAt: user.createdAt }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
