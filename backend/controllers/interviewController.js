const Interview = require('../models/Interview');
const InterviewStage = require('../models/InterviewStage');
const StageLookup = require('../models/stage_lookup');
const Applicant = require('../models/Applicant');
const Interviewer = require('../models/Interviewer');
const Job = require('../models/Job');
const { Op } = require('sequelize');

// Get all interviews for an applicant
exports.getInterviews = async (req, res) => {
  try {
    const { applicantId } = req.params;
    console.log('Fetching interviews for applicant:', applicantId);
    
    // First check if applicant exists
    const applicant = await Applicant.findByPk(applicantId);
    if (!applicant) {
      console.log('Applicant not found:', applicantId);
      return res.status(404).json({ message: 'Applicant not found' });
    }

    console.log('Found applicant:', applicant.id);

    // Get interviews with interviewer details
    const interviews = await Interview.findAll({
      where: { applicant_id: applicantId },
      include: [{
        model: Interviewer,
        as: 'interviewer',
        attributes: ['id', 'name', 'position', 'interview_type']
      }],
      order: [['date_time', 'DESC']]
    });

    console.log('Found interviews:', interviews.length);
    res.status(200).json(interviews);
  } catch (error) {
    console.error('Error in getInterviews:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching interviews',
      error: error.message,
      stack: error.stack 
    });
  }
};

// Get a single interview
exports.getInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      where: { id: req.params.id },
      include: [{
        model: Interviewer,
        as: 'interviewer',
        attributes: ['id', 'name', 'position', 'interview_type']
      }]
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.status(200).json(interview);
  } catch (error) {
    console.error('Error in getInterview:', error);
    res.status(500).json({ message: 'Error fetching interview' });
  }
};

// Schedule first interview
exports.scheduleFirstInterview = async (req, res) => {
  try {
    const { applicant_id, interviewer_id, date_time, job_id } = req.body;

    // Validate applicant and job
    const applicant = await Applicant.findByPk(applicant_id, {
      include: [{
        model: Job,
        as: 'job'
      }]
    });
    if (!applicant) {
      return res.status(404).json({ message: 'Applicant not found' });
    }

    // Validate interviewer exists and is HR type
    const interviewer = await Interviewer.findByPk(interviewer_id);
    if (!interviewer) {
      return res.status(404).json({ message: 'Interviewer not found' });
    }
    if (interviewer.interview_type !== 'HR') {
      return res.status(400).json({ message: 'First interview must be with an HR interviewer' });
    }

    // Get the first stage (HR)
    const firstStage = await StageLookup.findOne({
      where: {},
      order: [['order', 'ASC']]
    });

    // Create interview
    const interview = await Interview.create({
      applicant_id,
      interviewer_id,
      date_time,
      status: 'scheduled',
      name: `${firstStage.name} - ${applicant.name}`
    });

    // Create first interview stage
    await InterviewStage.create({
      interview_id: interview.id,
      stage_id: firstStage.id,
      result: 'pending'
    });

    // Update applicant status
    await applicant.update({ status: 'interviewing' });

    // Return full interview details
    const fullInterview = await Interview.findByPk(interview.id, {
      include: [
        {
          model: InterviewStage,
          as: 'stages',
          include: [{ 
            model: StageLookup, 
            as: 'stage' 
          }]
        },
        {
          model: Interviewer,
          as: 'interviewer',
          attributes: ['id', 'name', 'position', 'interview_type']
        },
        {
          model: Applicant,
          as: 'applicant',
          attributes: ['id', 'name', 'email', 'status'],
          include: [{
            model: Job,
            as: 'job',
            attributes: ['id', 'title', 'company']
          }]
        }
      ]
    });

    res.status(201).json(fullInterview);
  } catch (error) {
    console.error('Error scheduling first interview:', error);
    res.status(500).json({ message: 'Error scheduling interview', error: error.message });
  }
};

// Schedule next interview
exports.scheduleNextInterview = async (req, res) => {
  try {
    const { applicant_id, interviewer_id, date_time } = req.body;

    // Find the applicant's latest interview and its stage
    const currentInterview = await Interview.findOne({
      where: { applicant_id },
      include: [
        {
          model: InterviewStage,
          as: 'stages',
          include: [{ 
            model: StageLookup, 
            as: 'stage' 
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (!currentInterview) {
      return res.status(404).json({ message: 'No previous interview found for this applicant' });
    }

    // Check if previous interview was completed and passed
    const currentStage = currentInterview.stages[0];
    if (currentStage.result !== 'pass') {
      return res.status(400).json({ 
        message: 'Cannot schedule next interview. Previous interview was not passed or is still pending.' 
      });
    }

    // Get current stage order
    const currentStageOrder = currentStage.stage.order;

    // Find the next stage
    const nextStage = await StageLookup.findOne({
      where: {
        order: currentStageOrder + 1
      }
    });

    if (!nextStage) {
      return res.status(400).json({ message: 'No next stage available. Interview process completed.' });
    }

    // Validate interviewer type matches next stage
    const interviewer = await Interviewer.findByPk(interviewer_id);
    if (!interviewer) {
      return res.status(404).json({ message: 'Interviewer not found' });
    }

    // Map stage names to interview types
    const stageToInterviewerType = {
      'HR Interview': 'HR',
      'Technical Round': 'Technical',
      'Cultural Fit': 'Cultural',
      'Final Round': 'Final'
    };

    if (interviewer.interview_type !== stageToInterviewerType[nextStage.name]) {
      return res.status(400).json({ 
        message: `This stage requires a ${stageToInterviewerType[nextStage.name]} interviewer` 
      });
    }

    // Create next interview
    const interview = await Interview.create({
      applicant_id,
      interviewer_id,
      date_time,
      status: 'scheduled',
      name: `${nextStage.name} - ${currentInterview.name.split(' - ')[1]}`
    });

    // Create interview stage
    await InterviewStage.create({
      interview_id: interview.id,
      stage_id: nextStage.id,
      result: 'pending'
    });

    // Return full interview details
    const fullInterview = await Interview.findByPk(interview.id, {
      include: [
        {
          model: InterviewStage,
          as: 'stages',
          include: [{ 
            model: StageLookup, 
            as: 'stage' 
          }]
        },
        {
          model: Interviewer,
          as: 'interviewer',
          attributes: ['id', 'name', 'position', 'interview_type']
        },
        {
          model: Applicant,
          as: 'applicant',
          attributes: ['id', 'name', 'email', 'status'],
          include: [{
            model: Job,
            as: 'job',
            attributes: ['id', 'title', 'company']
          }]
        }
      ]
    });

    res.status(201).json(fullInterview);
  } catch (error) {
    console.error('Error scheduling next interview:', error);
    res.status(500).json({ message: 'Error scheduling interview', error: error.message });
  }
};

// Schedule specific interview stage
exports.scheduleSpecificStage = async (req, res) => {
  try {
    const { applicant_id, interviewer_id, date_time, stage_name } = req.body;

    // Find the stage by name
    const stage = await StageLookup.findOne({
      where: { name: stage_name }
    });

    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
    }

    // Get applicant details
    const applicant = await Applicant.findByPk(applicant_id, {
      include: [{
        model: Job,
        as: 'job'
      }]
    });

    if (!applicant) {
      return res.status(404).json({ message: 'Applicant not found' });
    }

    // Validate interviewer type matches stage
    const interviewer = await Interviewer.findByPk(interviewer_id);
    if (!interviewer) {
      return res.status(404).json({ message: 'Interviewer not found' });
    }

    // Map stage names to interview types
    const stageToInterviewerType = {
      'HR Interview': 'HR',
      'Technical Round': 'Technical',
      'Cultural Fit': 'Cultural',
      'Final Round': 'Final'
    };

    if (interviewer.interview_type !== stageToInterviewerType[stage.name]) {
      return res.status(400).json({ 
        message: `This stage requires a ${stageToInterviewerType[stage.name]} interviewer` 
      });
    }

    // Check if this stage was already completed for this applicant
    const existingInterview = await Interview.findOne({
      where: { applicant_id },
      include: [{
        model: InterviewStage,
        as: 'stages',
        where: { stage_id: stage.id }
      }]
    });

    if (existingInterview) {
      return res.status(400).json({ 
        message: `${stage.name} was already conducted for this applicant` 
      });
    }

    // Create interview
    const interview = await Interview.create({
      applicant_id,
      interviewer_id,
      date_time,
      status: 'scheduled',
      name: `${stage.name} - ${applicant.name}`
    });

    // Create interview stage
    await InterviewStage.create({
      interview_id: interview.id,
      stage_id: stage.id,
      result: 'pending'
    });

    // Return full interview details
    const fullInterview = await Interview.findByPk(interview.id, {
      include: [
        {
          model: InterviewStage,
          as: 'stages',
          include: [{ 
            model: StageLookup, 
            as: 'stage' 
          }]
        },
        {
          model: Interviewer,
          as: 'interviewer',
          attributes: ['id', 'name', 'position', 'interview_type']
        },
        {
          model: Applicant,
          as: 'applicant',
          attributes: ['id', 'name', 'email', 'status'],
          include: [{
            model: Job,
            as: 'job',
            attributes: ['id', 'title', 'company']
          }]
        }
      ]
    });

    res.status(201).json(fullInterview);
  } catch (error) {
    console.error('Error scheduling specific stage interview:', error);
    res.status(500).json({ message: 'Error scheduling interview', error: error.message });
  }
};

// Update interview status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const interview = await Interview.findByPk(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    await interview.update({ status });
    res.status(200).json(interview);
  } catch (error) {
    console.error('Error updating interview status:', error);
    res.status(500).json({ message: 'Error updating interview status' });
  }
};

// Submit interview feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { interview_id } = req.params;
    const { feedback, result, notes } = req.body;

    const interviewStage = await InterviewStage.findOne({
      where: { interview_id }
    });

    if (!interviewStage) {
      return res.status(404).json({ message: 'Interview stage not found' });
    }

    await interviewStage.update({
      feedback,
      result,
      notes,
      completed_at: new Date()
    });

    // Get updated stage with associations
    const updatedStage = await InterviewStage.findOne({
      where: { interview_id },
      include: [{
        model: StageLookup,
        as: 'stage',
        attributes: ['name', 'order']
      }]
    });

    res.status(200).json(updatedStage);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Error submitting feedback' });
  }
};