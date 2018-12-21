
const parseWebhookFromWelcomeCallForm = (body) => {
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
  console.log(JSON.stringify(user)+"\n");
  return user;
  };

  module.exports.parseWebhook = parseWebhookFromWelcomeCallForm;

var payload= ({"id":"1249","row":"1249","COL$T":"Grant Dohrman","COL$S":"N/A","COL$R":"chelsea.knisely@sharpspring.com","COL$Q":"Cassandra Garcia","COL$P":"No","COL$O":"Complete","COL$N":"Complete","COL$M":"","COL$L":"jmedlin@clarishealth.com - Jason","COL$K":"May have to be on top of his app knowledge.","COL$J":"60","COL$I":"N/A","COL$H":"N/A","COL$G":"Have consulting from Growthwright for hand off. ","COL$F":"\"Unusual situation\" ClarisHealth has been around for about 5 years, introduce to SharpSpring through an agency (Growthwright) purchased a license through them. Growthwright is changing their marketing departmentand are leaving SharpSpring. ClarisHealth, chose to move forward with SharpSpring. \nHave been using SharpSpring for \"several months\" primarily with the CRM. Utilizing the product \"87% utilization score.\"","COL$E":"308463047","COL$D":"ClarisHealth","COL$C":"ctucker@clarishealth.com","COL$B":"12/10/2018","COL$A":"12/10/2018 16:52:04","_content_hash":"a963b9b20eee6700938bce5f3b642d70"});

  //parseWebhookFromWelcomeCallForm(payload);