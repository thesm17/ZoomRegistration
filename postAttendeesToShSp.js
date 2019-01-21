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
  } catch (err) {console.log(err); return err;}
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
/** 

 This funtion will interate through all participants to see if they're a ShSp contact, and which classes they've already attended.
 If they are a lead in ShSp, they'll have @param data.method = "updateLeads";  otherwise usefulBody.method = "createLeads"
 If this is their first webinar, they'll have: @param data.body.date_of_first_webinar_5c41e3c27c51e be the current time.
 If they aren't a contact yet, 

**/

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
    newLeadReponse = await postLeads(allLeads.newLeads, "createLeads"); }
  updateLeadResponse = await postLeads(allLeads.updateLeads, "updateLeads");
  return {newLeadReponse: newLeadReponse, 
          updateLeadResponse: updateLeadResponse}
  
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
    meetingID: "hello",
    meetingTopic: "SharpSpring Virtual Classroom Essential Curriculum",
    //message: "",
  }
}

doIt(testData)
  .then((response) => {console.log(response)})
  .catch((err) => {console.error(err)})