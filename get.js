var request = require('request');
var clientData;

var payload= {
"id":"1249",
"row":"1249",
"COL$T":"Grant Dohrman",
"COL$S":"N/A",
"COL$R":"chelsea.knisely@sharpspring.com",
"COL$Q":"Cassandra Garcia",
"COL$P":"No",
"COL$O":"Complete",
"COL$N":"Complete",
"COL$M":"smitty.penman+"+Math.floor(Math.random()*1000)+"@sharpspring.com - Jason",
"COL$L":"smitty.penman+"+Math.floor(Math.random()*1000)+"@sharpspring.com - Jason",
"COL$K":"May have to be on top of his app knowledge.",
"COL$J":"60",
"COL$I":"N/A",
"COL$H":"N/A",
"COL$G":"Have consulting from Growthwright for hand off. ",
"COL$F":"\"Unusual situation\" ClarisHealth has been around for about 5 years, introduce to SharpSpring through an agency (Growthwright) purchased a license through them. Growthwright is changing their marketing departmentand are leaving SharpSpring. ClarisHealth, chose to move forward with SharpSpring. \nHave been using SharpSpring for \"several months\" primarily with the CRM. Utilizing the product \"87% utilization score.\"",
"COL$E":"308463047",
"COL$D":"ClarisHealth",
"COL$C":"ctucker@clarishealth.com",
"COL$B":"12/31/2018",
"COL$A":"12/10/2018 16:52:04",
"_content_hash":"a963b9b20eee6700938bce5f3b642d70",
};
var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJPVWJlZERLYVRzbXpHanB3Mi1VODN3IiwiZXhwIjoiMTU0NjI4OTYxOCJ9.HyygVT5QIM1dp4TcmLGiCnnNXSS3STVu17P95uILud0';

/**** *
* For testing. 
* @param Payload was a real line at some point.
*/

processData(payload);


/****
// @param input is the zapier webhook data, already run through body-parser. 
//
*/
function processData(input)   {
  var status = new Promise((res, rej) => {
    clientData = parseWebhookFromWelcomeCallForm(input);
    var getRecentWebinars = new Promise((resolve,reject) => {
      request.get('https://api.zoom.us/v2/users/qr3FSl74TEuOzC4jqlo36g/webinars?page_size=30&page_number=1', 
      {
        headers: { 'Authorization': 'Bearer '+token}
      },
        function(error, response, body){
          if (!error && response.statusCode == 200) {
            webinars=JSON.parse(body);
            resolve(webinars);
          } else {      
            reject(new DOMException("problem connecting to API"));
          }
        }
      )});
    getRecentWebinars.then(function (value) {
      try{
        matchCorrectWebinar(clientData,value);
          Promise.all([registerPrimaryContact(clientData),registerSecondaryContacts(clientData)]).
          then(function(values) {
            res(values);
          }); 
        
    }catch(error) {console.error(error); rej(error)}
  })});
  status.then(function(values){
    console.log(
      `Here is what Zapier will get when it's all finished:\n
      ${status.toString()}
      ${JSON.stringify(clientData)}\n
      ${values}`);
  })
}

function parseWebhookFromWelcomeCallForm(body) {
  //Check to make sure there are a date, an email address, and a company name
  //Col D is company, B is welcome call date, primary email is L, secondary is M
   if (!(body.COL$L && body.COL$D &&body.COL$B)){return error("Missing necessary information") }
 
  var email, company, welcomeCallDay, meetingID, primaryUser, secondaryUser, user;
      
   user = {
     company : body.COL$D,
     welcomeCallDay : body.COL$B,
     meetingID,
   };
   user.primaryUser = {email: body.COL$L.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)}
   if (body.COL$M) {
   user.secondaryUser = {email: body.COL$M.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)}
     }
   return user;
   };

const matchCorrectWebinar = (clientData, webinarList) => {
  let today = new Date(clientData.welcomeCallDay);
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

  var correctWebinar = webinarList.webinars.filter((webinar) => {
    let webinarDay = new Date(webinar.start_time);
    //Uncomment to see how many days between welcome call and all webinars
    //console.log(daysBetween(today,webinarDay));
    return (JSON.parse(daysBetween(today,webinarDay)>5 && daysBetween(today,webinarDay)<13)&& webinar.topic.match("Essential"));
    });
  if (typeof correctWebinar[0]==="undefined"){
    console.error("Undefined meeting aka no webinar next week.");
    return new Error("No scheduled webinars next week")
  };
  clientData.meetingID=correctWebinar[0].id;
  console.log("Zoom webinar ID: "+ clientData.meetingID);
  return clientData.meetingID;
  
  }

function registerPrimaryContact(clientData) {
  var body = ({
    email: clientData.primaryUser.email[0],
    first_name: clientData.primaryUser.email[0],
    last_name: clientData.company,
    org: clientData.company
  });

  var jsonBody = JSON.stringify(body);

  return new Promise((resolve,reject) => {
    request.post(`https://api.zoom.us/v2/webinars/${clientData.meetingID}/registrants`, 
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

function registerSecondaryContacts (clientData) {
  if (clientData.secondaryUser) {
    //console.log(JSON.stringify(clientData.secondaryUser.email));
    clientData.secondaryUser.email.forEach((user,index) => {
      var body = ({
        email: clientData.secondaryUser.email[index],
        first_name: clientData.secondaryUser.email[index],
        last_name: clientData.company,
        org: clientData.company
      });

      var jsonBody = JSON.stringify(body);

      return new Promise((resolve,reject) => {
        request.post(`https://api.zoom.us/v2/webinars/${clientData.meetingID}/registrants`, 
          {
            headers: { 
              'Authorization': 'Bearer '+token,
              'Content-Type': 'application/json'
            },
            body: jsonBody
          },
          function(error, response, body){
            if (error) {reject(console.log("Issue posting to zoom: "+error));}
            console.log("Secondary users response from zoom:\n "+body+"\n");
            resolve(body); 
            }
          )
        });
      })}
      
  
  else return ("No secondary users registered.");
}
