var request = require("request-promise");
require('dotenv').config();

// ShSp field for group demo is @param group_demo_attended_5bd140123991a


const updateLeadField = async (overWriteCurrentValues, email, fieldToUpdate, valueToUpdate) => {
  try {
    var data = await Promise.all([getLead(email),getFields(fieldToUpdate)]);
    var lead = data[0], field = data[1];
    
    // Check that field exists in ShSp
    if (field){

      // If lead exists and doesn't want to be overwritten 
      //  then get current value and concat new value, 
      //  then parse unique values 
      if (lead && overWriteCurrentValues === false) {
          valueToUpdate=getUniqueValues(lead[fieldToUpdate]+","+valueToUpdate);} 
      
      const body = {
        method: getMethod(email),
        body: [{
          emailAddress: email,
          [fieldToUpdate]: valueToUpdate
        }]
      }

      var response = await postLeads(body.method, body.body);
      return response;
      
    } else {
      //Field didn't exist
      throw new Error("That field, "+fieldToUpdate+", doesn't exist.")}
  } catch (err) {console.log(err); throw new Error(err)}
}

const getMethod = (lead) => {
  if (lead) {return "updateLeads"} else {return "createLeads"}
}


const getFields = async (fieldID) => {
  var options = { 
    method: 'POST',
    url: `https://api.sharpspring.com/pubapi/v1/`,
    qs:{
      accountID: `${process.env.AccID}`,
      secretKey: `${process.env.SecKey}`},
    headers: {
      'cache-control': 'no-cache',
      'Content-Type': 'application/json' },
    body: { 
      method: 'getFields', 
      params: { where: {"systemName": `${fieldID}`}}, 
      id: `${(new Date())}` },
    json: true }; 

  try {
    var result = await (request(options));
    return {
      fieldID: fieldID,
      dataType: result.result.field[0].dataType
    }
  } catch (err) {
    console.log(err); 
    throw new Error(err)}
}

// [START] Configure Zoom api Token
const jwt = require('jsonwebtoken');

const payload = {
    iss: `${process.env.ZoomAccID}`,
    exp: ((new Date()).getTime() + 5000)
};
const token = "Bearer " + jwt.sign(payload, `${process.env.ZoomSecKey}`);
// [END] Configure Zoom api Token


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
  var unique = new Set(values.split(',')), uniqueValues="";
  if (unique.has("")) unique.delete("");
  var uniqueArray = Array.from(unique);
  uniqueArray.map((word,index)=>{
    uniqueValues+=(word)
    if (index+1<uniqueArray.length) uniqueValues+=", "
  })
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

const postLeads = async (method, leads) => {
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

updateLeadField(false, "smitty.penman@sharpspring.com","group_demo_attended_5bd140123991a","yes");

//getFields("is_the_lead_a_current_customer_for_any_other_compa_545a706ebd2f1");