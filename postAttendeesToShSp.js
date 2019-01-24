/*** 
 
This program receives a webhook from Zoom when the recording from any webinar is finished. 
The body of that contains @param recording_link,@param meeting_topic, and @param meeting_id .

* todo GET https://api.zoom.us/v2/report/webinars/{webinarId}/participants
* ! example webinarId is nJ3yHuSsRTWlTYx7hBK8TQ==
/*/

var request = require("request-promise");
require('dotenv').config();

// [START] Configure Zoom api Token
const jwt = require('jsonwebtoken');

const payload = {
    iss: `${process.env.ZoomAccID}`,
    exp: ((new Date()).getTime() + 5000)
};
const token = "Bearer " + jwt.sign(payload, `${process.env.ZoomSecKey}`);
// [END] Configure Zoom api Token


const getCourse = (topic) => {
  // * Determine which learning path (essential, intermediate, or special topics)
  var learningPath=""
  if (topic.toString().includes("Essential")) {
    learningPath = "class_1_attended_5c4093bbcf4ab";
  }
    else if (topic.toString().includes("Intermediate")) {
    learningPath = "intermediate_classes_5c40de11e10cf";
    
  } 
    else if (topic.toString().includes("Special")) {
    learningPath = "special_topics_5c40de7fc9003";
  } else {console.error("That's not a recognized kind of course."); throw new Error(topic + "is not a valid class topic");}

  // * Determine which class number
  var today = (new Date()).getDay();
  if (today<1 || today >5) today = 1;
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
      Authorization: token,
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
  } catch (err) {
    console.log(err); 
    throw new Error(err)}
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

const getUniqueValues = (values) => {
  var words = values.split(',');
  var unique = new Set(words);
  if (unique.has("")) unique.delete("");
  var uniqueValues="";
  for (let word of unique.values()){
    uniqueValues+=(","+word)
  };
  return uniqueValues;
}

const updateParticipantLeadRecords = async (participants, topic) => {
  // * Grab which classes they've already attended from ShSp
  var classesAttended = await Promise.all(participants.map(async(participant) => { 
    var data;
    var lead = await getLead(participant.email);
    // If lead already exists in ShSP
    if (lead) {
      data = {
          body: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            emailAddress: lead.emailAddress,
            [topic.courseName]: lead[topic.courseName] + topic.courseNumber
          },
          method: "updateLeads"
      }
      // If this is the first webinar they've attended
      if (!lead.date_of_first_webinar_5c41e3c27c51e) 
        {data.body.date_of_first_webinar_5c41e3c27c51e = topic.timeNow}

      data.body[topic.courseName] = getUniqueValues(data.body[topic.courseName]);
    } 
    // If lead doesn't yet exist in ShSp
    else {
      data = {
        body: {
          lastName: participant.name,
          emailAddress: participant.email,
          [topic.courseName]: topic.courseNumber,
          leadStatus: "contact",
          date_of_first_webinar_5c41e3c27c51e: topic.timeNow
        },
        method: "createLeads"
    }
  }
  return data    
  }
  ))
  return classesAttended;
}

const formatForPost = (participants) => {
  var newLeads = participants.filter((lead) => {
    if (lead.method.includes("createLeads")) {return JSON.stringify(lead);}
  });

  var updateLeads = participants.filter((lead) => {
    if (lead.method.includes("updateLeads")) {return JSON.stringify(lead);}
  })

  var newLeadsArray = newLeads.map((lead) => {
    return lead.body;
  })

  var updateLeadsArray = updateLeads.map((lead) => {
    return lead.body;
  })

return {newLeads: (newLeadsArray),
        updateLeads: (updateLeadsArray)}
}

const postLeads = async (leads, method) => {
  var options = { method: 'POST',
  url: 'https://api.sharpspring.com/pubapi/v1/',
  qs: 
   { accountID: process.env.AccID,
     secretKey: process.env.SecKey },
  headers: 
   { 'cache-control': 'no-cache',
     'Content-Type': 'application/json' },
  body: 
   { method: method,
     params: {
       objects: leads,
      },
     id: "1001" },
  json: true };
try {
  var lead = await request(options);
  return lead;
} catch (err) {return err}
  
}

const postNewClassesToShSp = async  (allLeads) => { 
  var newLeadReponse = "No new leads", updateLeadResponse;
  if (allLeads.newLeads.length>0){
    // [Start postLeads]
    // -- Post leads, new and updates, to ShSp.
    // -- Handle connection errors and leads not existing
    newLeadReponse = await postLeads(allLeads.newLeads, "createLeads"); }
  updateLeadResponse = await postLeads(allLeads.updateLeads, "updateLeads");
  // [End postLeads]
  return {newLeadReponse: newLeadReponse, 
          updateLeadResponse: updateLeadResponse}
  
}

exports.postAttendeesToShSp = async (req, res) => {

  var meetingID = req.body.meeting_id, meetingTopic = req.body.meeting_topic;
  try {

    // [Start getCouse] 
    // -- get the class topic name and number from Zoom
    var course = getCourse(meetingTopic);
      console.log(course);
    // [end getCourse]

    // [Start getParticipants] 
    // -- Use the meetingID provided by webhook to query Zoom for list of participants.
    // 
    // Clean out empty records and throw an error if meetingID doesn't exist.
    var leadRecords = await getParticipants(meetingID);
      
    // [end getParticipants]

    // [Start updateParticipantLeadRecords]
    // -- Query ShSp to see if contact records exist, 
    //    and for those that do, see which classes they've already attended of today's topic
    // -- Handle if the email address does or doesn't exist, and whether or not they've attended classes
    var participantRecords = await updateParticipantLeadRecords(leadRecords, course);
      console.log("Participant records: ");
      participantRecords.map((lead)=> {console.log(lead.body.emailAddress)})    
    // [end updateParticipantLeadRecords]

    // [Start formatForPost]
    // -- Split participants into new leads and update leads and return two separate array objects
    var formattedPost = formatForPost(participantRecords);
    // [end formateForPost]

    // [Start postNewClassesToShSp]
    // -- Post new and updated records to shapeInside
    // Additional comments inside function
    var result = (await postNewClassesToShSp(formattedPost));
    // [End postNewClassesToShSp]

    // Prep message for sending
    var leadResultsExplained = result.updateLeadResponse.result.updates.map((res)=> {return JSON.stringify(res)})
    
    var message = req.query.message || req.body.message || 
    (`Response from Zoom/ShSp: \n ${JSON.stringify(result)}`
    );

    //Send response to CGF
    res.status(200).send(message);

    // For debug, printing -- will this happen anywhere? 
    return ({
      participantRecords: participantRecords.map((lead)=>{return lead.body.emailAddress}),
      finalResult: {
        newLeadShSpResult: result.newLeadReponse,
        updateLeadResult: result.updateLeadResponse,
        updateLeadResultsExplained: result.updateLeadResponse.result.updates.map((res)=> {return JSON.stringify(res)})
      }
              });
    
  } catch (err) {
    console.log(err);
    var message = req.query.message || req.body.message || `There was an issue during the process:\n ${err}`;
    res.status(200).send(message);
    return err
  }
}

async function doIt(req, res) {
  var meetingID = req.body.meetingID, meetingTopic = req.body.meetingTopic;
  try {
    var course = getCourse(meetingTopic);
    var leadRecords = await getParticipants(meetingID);
    var participantRecords = await updateParticipantLeadRecords(leadRecords, course);
    var formattedPost = formatForPost(participantRecords);
    var result = (await postNewClassesToShSp(formattedPost));
    //var message = req.query.message || req.body.message || 
    `Response from Zoom/ShSp: \n ${(result)}`;
    //res.status(200).send(message);
    return ({
      participantRecords: participantRecords.map((lead)=>{return lead.body.emailAddress}),
      finalResult: {
        newLeadShSpResult: result.newLeadReponse,
        updateLeadResult: result.updateLeadResponse,
        updateLeadResultsExplained: result.updateLeadResponse.result.updates.map((res)=> {return JSON.stringify(res)})
      }
              });
    
  } catch (err) {
    console.log(err);
    //var message = req.query.message || req.body.message || `There was an issue during the process:\n ${err}`;
    //res.status(200).send(message);
    return err
  }
}

var testData = {
  body: {
    meetingID: "nJ3yHuSsRTWlTYx7hBK8TQ==",
    meetingTopic: "SharpSpring Virtual Classroom Essential Curriculum",
  }
}

/* 
data={  "meeting_id": "nJ3yHuSsRTWlTYx7hBK8TQ==",
        "meeting_topic": "SharpSpring Virtual Classroom Essential Curriculum"}
 
functions deploy postAttendeesToShSp --env-vars-file .env.yaml --trigger-http 

curl -X POST "http://localhost:8010/marine-copilot-224719/us-central1/postAttendeesToShSp " -H "Content-Type:application/json" --data '{"meeting_id":"nJ3yHuSsRTWlTYx7hBK8TQ==","meeting_topic":"SharpSpring Virtual Classroom Essential Curriculum"}'

functions logs read

$ gcloud beta functions deploy helloEnvVars --trigger-http --update-env-vars SUCH_SECRET=Updated --project <projectID>
*/