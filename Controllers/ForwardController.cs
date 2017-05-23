using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Web;
using System.Web.Http;
using System.Web.Http.Cors;

namespace BizCover.Utility.Service.Api.Controllers
{
    [EnableCors(origins: "*", headers: "*", methods: "*")]
    public class ForwardController : ApiController
    {
        // GET api/salesforce
        [Route("api/salesforce")]
        public IHttpActionResult Get()
        {
            try
            {
                String currurl = HttpContext.Current.Request.RawUrl;
                String querystring = null;

                // Check to make sure some query string variables
                int iqs = currurl.IndexOf('?');
                if (iqs == -1)
                    return BadRequest();

                if (iqs >= 0)
                    querystring = (iqs < currurl.Length - 1) ? currurl.Substring(iqs + 1) : String.Empty;

                // Parse the query string variables into a NameValueCollection.
                if (querystring != null)
                {
                    NameValueCollection collection = HttpUtility.ParseQueryString(querystring);

                    var salesforceUrl = collection["SalesForceUrl"];
                    collection.Remove("SalesForceUrl");

                    Stream postDataStream = GetPostStream(collection);

                    WebRequest webRequest = WebRequest.Create(salesforceUrl);
                    webRequest.ContentLength = postDataStream.Length;
                    webRequest.ContentType = "application/x-www-form-urlencoded";
                    webRequest.Method = "POST";

                    Stream reqStream = webRequest.GetRequestStream();

                    postDataStream.Position = 0;

                    byte[] buffer = new byte[1024];
                    int bytesRead = 0;

                    while ((bytesRead = postDataStream.Read(buffer, 0, buffer.Length)) != 0)
                    {
                        reqStream.Write(buffer, 0, bytesRead);
                    }

                    postDataStream.Close();
                    reqStream.Close();

                    var response = webRequest.GetResponse();

                    HttpStatusCode result = ((HttpWebResponse) response).StatusCode;
                    if ((result != HttpStatusCode.OK) || ((HttpWebResponse) response).Headers.ToString().ToLower().IndexOf("exception") > 0)
                        return Ok();
                }
            }
            catch (Exception ex)
            {
                return Ok();

            }

            return Ok();
        }

        private Stream GetPostStream(NameValueCollection formData)
        {
            if (formData == null)
                return null;

            Stream postDataStream = new System.IO.MemoryStream();

            List<string> fields = new List<string>();
            foreach (string key in formData.AllKeys)
                fields.Add(key + "=" + formData[key]);

            string allFields = String.Join("&", fields);

            byte[] bytes = System.Text.Encoding.UTF8.GetBytes(allFields);
            postDataStream.Write(bytes, 0, bytes.Length);

            return postDataStream;
        }
        
    }
}
