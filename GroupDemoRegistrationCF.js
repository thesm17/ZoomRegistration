var request = require("request-promise");
require('dotenv').config();

var demoTimeField = "group_demo_date_time_selected_5bec9213aaa16",
 demoTypeField ="group_appointment_type_5bd8966a8d9dd",
 agencyDemo = "Live group demo for your Agency",
 endUserDemo = "Live group demo for your Business",
 clientData;

var token = process.env.ZoomToken, 
    agencyEmail = "agencydemos@sharpspring.com",   
    endUserEmail = "businessdemos@sharpspring.com";

function parseWebhookFromDemoForm(body) {
  /*
  body will be JSON object with field names from ShSp post back of lead data.
  Important keys are: emailAddress, firstName, lastName, organization name, and meeting time. 
  */ 

  var user = {
    company: body.companyName,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.emailAddress,
    accountEmail: "",
    meetingID: "",
    requestedDay: body.group_demo_date_time_selected_5bec9213aaa16
  };

  if (body.group_appointment_type_5bd8966a8d9dd===agencyDemo){
    user.clientType = "agency";
    user.accountEmail = "agencydemos@sharpspring.com"
  }
  else{
    user.clientType = "end user";
    user.accountEmail = "businessdemos@sharpspring.com"
  }
  console.log(JSON.stringify(user));
  return user;
};    

const getRecentMeetings = async (client) => {
  var options = { 
    method: 'GET',
    url: `https://api.zoom.us/v2/users/${client.accountEmail}/meetings?page_size=3000&page_number=1`,
    headers: 
    {'cache-control': 'no-cache',
      Authorization: `${process.env.ZoomToken}`,
      'Content-Type': 'application/json' } };
  try {
    var webinars = await (request(options));
    return webinars;
  } catch (err) {
    console.log(err); 
    throw new Error(err)}
}

const sameDay = (d1, d2) => {
    return (d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate() &&
      d1.getHours() === d2.getHours());
    }

const matchCorrectMeeting = async (clientData, recentMeetings) => {
  let requestedDay = new Date(clientData.requestedDay);

  try {
    var correctMeeting = JSON.parse(recentMeetings).meetings.filter((meeting) => {
      let meetingDay = new Date(meeting.start_time);
      return (sameDay(requestedDay,meetingDay));
    });

    if (correctMeeting[0]){
      clientData.meetingID=correctMeeting[0].id;
      console.log("Zoom meeting ID: "+ clientData.meetingID+" at "+requestedDay);
      return clientData.meetingID;
     } 
     else throw new Error("No scheduled meetings at that time, "+requestedDay);
  } catch (e) {
    console.error(e);
    throw new Error(e);
  }
}

const registerContact = async (clientData) => {
  var body = ({
    email: clientData.email,
    first_name: clientData.firstName,
    last_name: clientData.lastName,
    org: clientData.company,
  });

  var jsonBody = JSON.stringify(body);
    var options = {
      method: 'POST',
      url: `https://api.zoom.us/v2/meetings/${clientData.meetingID}/registrants`,
      headers:{
        'cache-control': 'no-cache',
        Authorization: `${process.env.ZoomToken}`,
        'Content-Type': 'application/json' },
      body: jsonBody };
    try {
      var zoomResponse = await request(options);
      return zoomResponse;
    } catch (err) {
      throw new Error("Error posting new registrant to Zoom: " + err);}
}


exports.processData = async (req, res) =>  {
  var input = req.body;
  try{
    clientData = parseWebhookFromDemoForm(input);
    var recentMeetings = await getRecentMeetings(clientData);
    var correctMeeting = await matchCorrectMeeting(clientData, recentMeetings)
    var zoomResponse = await registerContact(clientData);
    console.log(zoomResponse);
    var message = req.query.message || req.body.message || `${zoomResponse}`;
    // send response to GCF
    res.status(200).send(message);

  } catch (e) {
    console.log(e);
    var message = req.query.message || req.body.message || `${e}`;
    // send response to GCF
    res.status(200).send(message);
  }
}

// const doIt = async (input) => {
//   try{
//     var input = input.body;
//     clientData = parseWebhookFromDemoForm(input);
//     var recentMeetings = await getRecentMeetings(clientData);
//     var correctMeeting = await matchCorrectMeeting(clientData, recentMeetings)
//     var zoomResponse = await registerContact(clientData, correctMeeting);
//     console.log(zoomResponse);
//   } catch (e) {
//     console.log(e);
//     return e;
//   }
// }


 var testData = 
  {body: {
  "id": "581494967298",
  "accountID": "6034855938",
  "ownerID": "4472",
  "companyName": "SharpSpring",
  "title": "Marketing Ops",
  "firstName": "Gary",
  "lastName": "Reinhard",
  "street": null,
  "city": null,
  "country": "United States",
  "state": "FL",
  "zipcode": "32605",
  "emailAddress": "gary@sharpspring.com",
  "website": "sharpspring.com",
  "phoneNumber": "555-5555",
  "officePhoneNumber": null,
  "appointment_type_59ce4af5ab9ba": "Live SharpSpring Demo for Your Agency",
  "group_appointment_type_5bd8966a8d9dd": "Live Group Demo for Your Business",
  "group_dop_5bd897898eaa3": "Clara Edwards",
  "dr_prospect___november_2018_5bd9b8dac8f64": "1",
  "ndr_prospect___november_2018_5bd9b9168e34a": "",
  "event_date_2019_5bd9ef4468ced": "2019-02-28 17:30:00",
  "event_attendance_date_2019_5bd9ef629a8d3": "2018-01-10 12:00:00",
  "crm_lead_assignment_date_5be1f66b2a617": "2018-11-07 23:26:53",
  "group_dop_acuity_link_5be451de95a42": "https://app.acuityscheduling.com/schedule.php?owner=12813528&calendarID=1921338",
  "c_s_list_id_5bec8457bb91b": "113351",
  "group_demo_date_time_selected_5bec9213aaa16": "2019-02-21 16:00:00",
  "group_demo_requested_date_time_5c0fcef517cd6": "2019-01-04 15:18:14",
  "presenter_interest_5c101e378b45c": "",
  "project_creation_date_5c11931413123": "2018-12-18 12:40:31",      
}}
// doIt(testData);
console.log(JSON.stringify({
  "id": "581494967298",  "accountID": "6034855938",  "ownerID": "4472",  "companyName": "SharpSpring",  "title": "Marketing Ops",
  "firstName": "Gary",  "lastName": "Reinhard",  "street": null,  "city": null,  "country": "United States",  "state": "FL",
  "zipcode": "32605",
  "emailAddress": "gary@sharpspring.com",
  "website": "sharpspring.com",
  "phoneNumber": "555-5555",
  "officePhoneNumber": null,
  "appointment_type_59ce4af5ab9ba": "Live SharpSpring Demo for Your Agency",
  "group_appointment_type_5bd8966a8d9dd": "Live Group Demo for Your Business",
  "group_dop_5bd897898eaa3": "Clara Edwards",
  "dr_prospect___november_2018_5bd9b8dac8f64": "1",
  "ndr_prospect___november_2018_5bd9b9168e34a": "",
  "event_date_2019_5bd9ef4468ced": "2019-02-28 17:30:00",
  "event_attendance_date_2019_5bd9ef629a8d3": "2018-01-10 12:00:00",
  "crm_lead_assignment_date_5be1f66b2a617": "2018-11-07 23:26:53",
  "group_dop_acuity_link_5be451de95a42": "https://app.acuityscheduling.com/schedule.php?owner=12813528&calendarID=1921338",
  "c_s_list_id_5bec8457bb91b": "113351",
  "group_demo_date_time_selected_5bec9213aaa16": "2019-02-21 16:00:00",
  "group_demo_requested_date_time_5c0fcef517cd6": "2019-01-04 15:18:14",
  "presenter_interest_5c101e378b45c": "",
  "project_creation_date_5c11931413123": "2018-12-18 12:40:31",      
}))
//curl -X POST "http://localhost:8010/marine-copilot-224719/us-central1/processData " -H "Content-Type:application/json" --data '{"id":"581494967298","accountID":"6034855938","ownerID":"4472","companyName":"SharpSpring","title":"Marketing Ops","firstName":"Gary","lastName":"Reinhard","street":null,"city":null,"country":"United States","state":"FL","zipcode":"32605","emailAddress":"gary@sharpspring.com","website":"sharpspring.com","phoneNumber":"555-5555","officePhoneNumber":null,"appointment_type_59ce4af5ab9ba":"Live SharpSpring Demo for Your Agency","group_appointment_type_5bd8966a8d9dd":"Live Group Demo for Your Business","group_dop_5bd897898eaa3":"Clara Edwards","dr_prospect___november_2018_5bd9b8dac8f64":"1","ndr_prospect___november_2018_5bd9b9168e34a":"","event_date_2019_5bd9ef4468ced":"2019-02-28 17:30:00","event_attendance_date_2019_5bd9ef629a8d3":"2018-01-10 12:00:00","crm_lead_assignment_date_5be1f66b2a617":"2018-11-07 23:26:53","group_dop_acuity_link_5be451de95a42":"https://app.acuityscheduling.com/schedule.php?owner=12813528&calendarID=1921338","c_s_list_id_5bec8457bb91b":"113351","group_demo_date_time_selected_5bec9213aaa16":"2019-02-21 16:00:00","group_demo_requested_date_time_5c0fcef517cd6":"2019-01-04 15:18:14","presenter_interest_5c101e378b45c":"","project_creation_date_5c11931413123":"2018-12-18 12:40:31"}'



exports.processData(testData);