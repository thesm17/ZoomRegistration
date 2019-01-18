/*** 
 
This program receives a webhook from Zoom when the recording from any webinar is finished. 
The body of that contains @param recording_link,@param meeting_topic, and @param meeting_id .

* todo Use today's day to establish which class they attended
* todo GET https://api.zoom.us/v2/report/webinars/{webinarId}/participants
* ! example webinarId is nJ3yHuSsRTWlTYx7hBK8TQ==

get list of participants emails from zoom, then loop through all of them with the following:
  getLeads where "emailAddress": @param participant_email . then class data is stored 
  Essential curriculum: @param body.result.lead[0].class_1_attended_5c4093bbcf4ab



* todo for each participant, use their email address to zap that data to ShSp with a payload like
@param {email, classAttended}

* ShSp field ID for essentials is @param class_1_attended_5c4093bbcf4ab
***/

//exports
var async = require("async");
var request = require("request-promise");
require('dotenv').config();


const getCourse = (topic) => {
  // * Determine which learning path (essential, intermediate, or special topics)
  var learningPath="", simpleName;
  if (topic.toString().includes("Essential")) {
    learningPath = "class_1_attended_5c4093bbcf4ab";
    simpleName = "essential"
  }
    else if (topic.toString().includes("Intermediate")) {
    learningPath = "intermediate_classes_5c40de11e10cf";
    simpleName = "intermediate"
    
  } 
    else if (topic.toString().includes("Special")) {
    learningPath = "special_topics_5c40de7fc9003";
    simpleName = "special"    
  } else {console.error("That's not a recognized kind of course."); return "Invalid class topic";}

  // * Determine which class number
  var today = (new Date()).getDay();
  var courseNumber = "Class "+today.toString();
  return {courseName: learningPath,
          courseNumber: `, ${courseNumber}`,
          timeNow: (new Date()).toString()}

}


async function getParticipants(webinarId){
  var options = { 
    method: 'GET',
    url: `https://api.zoom.us/v2/report/webinars/${webinarId}/participants`,
    headers: 
    {'cache-control': 'no-cache',
      Authorization: `${process.env.ZoomToken}`,
      'Content-Type': 'application/json' } };
  try {
    var result = await (request(options));
    var participantList = JSON.parse(result).participants.map(element => {
      return {name: element.name,
              email: element.user_email};
    })
    var cleanParticipantList = participantList.filter((e)=> {
      if (e.email.length>4) return e;
    })
    return cleanParticipantList;
  } catch (err) {console.log(err)}
}

async function getLead(email){
  var options = { method: 'POST',
  url: 'https://api.sharpspring.com/pubapi/v1/',
  qs: 
   { accountID: process.env.AccID,
     secretKey: process.env.SecKey },
  headers: 
   { 'cache-control': 'no-cache',
     'Content-Type': 'application/json' },
  body: 
   { method: 'getLeads',
     params: { where: { emailAddress: email } },
     id: `${Math.floor(Math.random*10000)}` },
  json: true };

  var lead = await request(options);
  return lead.result.lead[0];

}

const updateParticipantLeadRecords = async (participants, topic) => {
  // * Grab which classes they've already attended from ShSp
  var classesAttended = await Promise.all(participants.map( async(participant) => { 
    if (participant.email){
      var usefulBody;
      var lead = await getLead(participant.email);
      if (lead) {
        usefulBody = {
          firstName: lead.firstName,
          lastName: lead.lastName,
          emailAddress: lead.emailAddress,
          [topic.courseName]: lead[topic.courseName].toString() + topic.courseNumber
        }
        if (!lead.date_of_first_webinar_5c41e3c27c51e) 
          {usefulBody.date_of_first_webinar_5c41e3c27c51e = topic.timeNow}
      } else {
        usefulBody = {
          lastName: participant.name,
          emailAddress: participant.email,
          [topic.courseName]: topic.courseNumber,
          leadStatus: "contact",
          date_of_first_webinar_5c41e3c27c51e: topic.timeNow
      }
    }
    return usefulBody    
  }
  }))
  return classesAttended;
}

const postNewClassesToShSp = async  (body) => {
  
}

async function doIt(req, res) {
  var meetingID = req.body.meetingID, meetingTopic = req.body.meetingTopic;

  var course = getCourse(meetingTopic);
  var leadRecords = await getParticipants(meetingID);
  var participantRecords = await updateParticipantLeadRecords(leadRecords, course);
  var body = JSON.stringify(participantRecords);
  var response = await postNewClassesToShSp(body);
  console.log(response);
  //var classesRegistered = await registerAttendance(participantRecords, course);
  
}

var testData = {
  body: {
    meetingID: "nJ3yHuSsRTWlTYx7hBK8TQ==",
    meetingTopic: "SharpSpring Virtual Classroom Essential Curriculum"
  }
}

doIt(testData);