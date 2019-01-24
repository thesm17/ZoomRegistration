var request = require('request-promise');
require('dotenv').config();

// [START] Configure Zoom api Token
const jwt = require('jsonwebtoken');

const payload = {
    iss: `${process.env.ZoomAccID}`,
    exp: ((new Date()).getTime() + 5000)
};
const token = "Bearer " + jwt.sign(payload, `${process.env.ZoomSecKey}`);
// [END] Configure Zoom api Token

var testData = {
"COL$L":"smitty.penman+"+Math.floor(Math.random()*1000)+"@sharpspring.com - Jason",
"COL$B": (new Date()),
"COL$D":"ClarisHealth",
"COL$M":"smitty.penman+"+Math.floor(Math.random()*1000)+"@sharpspring.com - Jason",
}


const registerContacts = async(companyInfo) => {
  try{
    response = await Promise.all([
      await registerPrimaryContact(companyInfo),
      await registerSecondaryContacts(companyInfo)]);
    return response;
  } catch (e) {console.log(e); throw new Error(e)}

}


const getRecentWebinars = async() => {
  var options = { 
    method: 'GET',
    url: `https://api.zoom.us/v2/users/qr3FSl74TEuOzC4jqlo36g/webinars?page_size=3000&page_number=1`,
    headers: 
    {'cache-control': 'no-cache',
      Authorization: token,
      'Content-Type': 'application/json' } };
  try {
    var webinars = await (request(options));
    return webinars;
  } catch (err) {
    console.log(err); 
    throw new Error(err)}
  ////////
  }

const parseWebhookFromWelcomeCallForm = (body) => {
  //Check to make sure there are a date, an email address, and a company name
  //Col D is company, B is welcome call date, primary email is L, secondary is M
   if (!(body.COL$L && body.COL$D &&body.COL$B)){
     throw new Error("Missing necessary information from Google Sheet. ") }
 
  var user = {
    company : body.COL$D,
    welcomeCallDay : body.COL$B,
    meetingID: "",
    primaryUser: {
      email: ""
    },
    secondaryUser: {
      email: ""
  }};

  user.primaryUser.email = body.COL$L.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)
  
  if (body.COL$M) {
    user.secondaryUser.email = body.COL$M.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)};
  
  // If invalid email
    if (!user.primaryUser.email) {
      throw new Error("Primary email address is invalid. Parsed value from welcome form of '"+ user.primaryUser.email+ 
         "' is undefined. It is most likely Column L from the spreadsheet did not have a proper email address.");
    } else return user;

  }   

const daysBetween = ( date1, date2 ) => {
  //Get 1 day in milliseconds
  var one_day=1000*60*60*24;

  // Convert both dates to milliseconds
  var date1_ms = new Date(date1).getTime();
  var date2_ms = new Date(date2).getTime();

  // Calculate the difference in milliseconds
  var difference_ms = date2_ms - date1_ms;
    
  // Convert back to days and return
  return Math.round(difference_ms/one_day); 
}

const matchCorrectWebinar = async (companyInfo, webinarList) => {
  let webinars = JSON.parse(webinarList).webinars;
  let today = new Date(companyInfo.welcomeCallDay); 
  try {
    var correctWebinar = webinars.filter((webinar) => {
      let webinarDay = new Date(webinar.start_time);
      return (JSON.parse(daysBetween(today,webinarDay)>5 && daysBetween(today,webinarDay)<13)&& webinar.topic.match("Essential"));
      })
    if (correctWebinar.length>1){
      console.log("Warning: there are two Essential webinars on that date. This person will be auto-registered for the first available time.");
      correctWebinar.map((e)=>{console.log(JSON.stringify("Start time: "+e.start_time+", webinar id: "+e.id));})
    }  
    ;
    console.log("Proper Zoom webinar ID: "+ correctWebinar[0].id);
    return correctWebinar[0].id;

    } catch (err) {
      throw new Error("Uh oh. There aren't any webinars titled 'Essential' with a final meeting day 6 to 12 days from input date, "+webinarDay)
    }  
  }

const registerPrimaryContact = async (clientData) => {
  var body = ({
    email: clientData.primaryUser.email[0],
    first_name: clientData.primaryUser.email[0],
    last_name: clientData.company,
    org: clientData.company
  });

  var jsonBody = JSON.stringify(body);
    var options = {
      method: 'POST',
      url: `https://api.zoom.us/v2/webinars/${clientData.meetingID}/registrants`,
      headers:{
        'cache-control': 'no-cache',
        Authorization: token,
        'Content-Type': 'application/json' },
      body: jsonBody };
    try {
      var zoomResponse = await request(options);
      return zoomResponse;
    } catch (err) {
      console.log(err)
      throw new Error("Error posting new registrant to Zoom: " + err);}

}

const registerSecondaryContacts = async (clientData) => {
  if (clientData.secondaryUser.email) {
    clientData.secondaryUser.email.forEach( async(user,index) => {
      var body = ({
      email: clientData.primaryUser.email[0],
      first_name: clientData.primaryUser.email[0],
      last_name: clientData.company,
      org: clientData.company
    });
  
    var jsonBody = JSON.stringify(body);
      var options = {
        method: 'POST',
        url: `https://api.zoom.us/v2/webinars/${clientData.meetingID}/registrants`,
        headers:{
          'cache-control': 'no-cache',
          Authorization: token,
          'Content-Type': 'application/json' },
          body: jsonBody };
      try {
        var zoomResponse = await request(options);
        return zoomResponse;
      } catch (err) {
        console.log(err)
        throw new Error("Error posting secondary registrant to Zoom: " + err);}
      })
    }
  else return ("No secondary users registered.");
}


exports.processData = async (req, res) => {
  try {
    var input = req.body

    //parse column data into JSON
    const companyInfo = parseWebhookFromWelcomeCallForm(input);

    // get whole webinar list from Zoom
    const webinarList = await getRecentWebinars(); 

    // using the date of the welcome call and the list of all webinars, 
    //  assign proper meeting as the first meeting of the day next week
    companyInfo.meetingID = await matchCorrectWebinar(companyInfo, webinarList);

    // push info to Zoom to register new participants and return response
    const registrationStatus = await registerContacts(companyInfo);

    // format response to GCF
    var returnString = "";
      registrationStatus.map((e)=>{
        returnString+=JSON.stringify(e);
      });
  
      var message = req.query.message || req.body.message || `${returnString}`;

    // send response to GCF
    res.status(200).send(message);
  }catch (error) {
    console.log("Oh no! There was an error! Error: "+ error);
    var message = req.query.message || req.body.message || `There was an error: ${error}`;
    res.status(200).send(message);
  }
}

//processData(testData);


//processData(payload).then(function(values){console.log("Final output: " + values)})
// .then((values) => {
//   console.log("These are the final values: " + values);
// })