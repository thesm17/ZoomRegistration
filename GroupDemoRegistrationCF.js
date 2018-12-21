var request = require('request');

var demoTimeField = "group_demo_date_time_selected_5bec9213aaa16",
 demoTypeField ="group_appointment_type_5bd8966a8d9dd",
 agencyDemo = "Live group demo for your Agency",
 endUserDemo = "Live group demo for your Business",
 clientData;

var 
  token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJPVWJlZERLYVRzbXpHanB3Mi1VODN3IiwiZXhwIjoiMTY0MDExNzU4NiJ9.N3cOn9z4-mSTFrpYDTMaBBymkbQ95DZuktr3HsX3OEk",
  agencyEmail = "agencydemos@sharpspring.com", 
  endUserEmail = "businessdemos@sharpspring.com";

exports.processData = (req, res) =>  {
  var input = req.body;
  var status = new Promise((res, rej) => {
    clientData = parseWebhookFromDemoForm(input);
    if (clientData.clientType=="agency") {
      var getRecentMeetings = new Promise((resolve,reject) => {
        request.get(`https://api.zoom.us/v2/users/${agencyEmail}/meetings`, 
        {
          headers: { 'Authorization': 'Bearer '+token}
        },
          function(error, response, body){
            if (!error && response.statusCode == 200) {
              meetings=JSON.parse(body);
              resolve(meetings);
            } else {      
              reject(new Error("Problem connecting to API"));
            }
          }
        )
      }).catch("Error connecting to Zoom API.")
    };
    //if End user then
    if (clientData.clientType=="end user") {
      var getRecentMeetings = new Promise((resolve,reject) => {
        request.get(`https://api.zoom.us/v2/users/${endUserEmail}/meetings`, 
        {
          headers: { 'Authorization': 'Bearer '+token}
        },
          function(error, response, body){
            if (!error && response.statusCode == 200) {
              meetings=JSON.parse(body);
              resolve(meetings);
            } else {      
              reject(("Problem connecting to API."));
            }
          }
        )
      })
    };
    getRecentMeetings.then(function (value) {
      try{
        matchCorrectmeeting(clientData,value);
        registerContact(clientData).
          then(function(values) {
            res(values);
          });} 
      catch(error) {console.error(error); rej(error)}
    })
  });

  status.then(function (values){
    let message = req.query.message || req.body.message || 
      `Response from Zoom:\n
      ${JSON.stringify(clientData)}\n
      ${values}`;
    res.status(200).send(message);
  })
}

function parseWebhookFromDemoForm(body) {
  /*
  body will be JSON object with field names from ShSp post back of lead data.
  Important keys are: emailAddress, firstName, lastName, organization name, and meeting time. 
  */ 

  var email, company, meetingID, user, clientType;
      
  user = {
    company: body.companyName,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.emailAddress,
    clientType,
    meetingID,
    requestedDay: body.group_demo_date_time_selected_5bec9213aaa16
  };

  if (body.group_appointment_type_5bd8966a8d9dd===agencyDemo){
    user.clientType = "agency";
  }
  else{
    user.clientType = "end user";
  }
  console.log(JSON.stringify(user));
  return user;
   };

const matchCorrectmeeting = (clientData, meetingList) => {

  let requestedDay = new Date(clientData.requestedDay);

  function sameDay(d1, d2) {
    console.log(d1+" and Zoom: "+d2)
    return (d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate() &&
      d1.getHours() === d2.getHours());
    }

  var correctmeeting = meetingList.meetings.filter((meeting) => {
    let meetingDay = new Date(meeting.start_time);
    return (sameDay(requestedDay,meetingDay));
    });

  if (typeof correctmeeting[0]==="undefined"){
    console.error("There is no meeting that day.");
    return new Error("No scheduled Meetings next week")
  };

  clientData.meetingID=correctmeeting[0].id;
  console.log("Zoom meeting ID: "+ clientData.meetingID);
  return clientData.meetingID;
  
  }

function registerContact(clientData) {

  var jsonBody = JSON.stringify({
    email: clientData.email,
    first_name: clientData.firstName,
    last_name: clientData.lastName,
    org: clientData.company,
  });

  return new Promise((resolve,reject) => {
    request.post(`https://api.zoom.us/v2/meetings/${clientData.meetingID}/registrants`, 
      {
        headers: { 
          'Authorization': 'Bearer '+token,
          'Content-Type': 'application/json'
        },
        body: jsonBody
      },
      function(error, response, body){
        if (error) {reject(console.log("Issue posting to zoom: "+error));}
        console.log("Body from zoom:\n "+body+"\n");
        resolve(body); 
        }
      )
    });

}

