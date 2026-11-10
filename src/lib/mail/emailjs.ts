/** EmailJS (Gmail u otro servicio conectado en su panel). Envío solo desde el servidor. */

export function mailConfigured(){
 return Boolean(
  process.env.EMAILJS_SERVICE_ID?.trim()
  && process.env.EMAILJS_TEMPLATE_ID?.trim()
  && process.env.EMAILJS_PUBLIC_KEY?.trim()
  && process.env.EMAILJS_PRIVATE_KEY?.trim()
 );
}

export type EmailJsPayload={
 toEmail:string;
 toName:string;
 subject:string;
 period:string;
 netPay:string;
 html:string;
 text:string;
};

export async function sendWithEmailJs(payload:EmailJsPayload){
 const serviceId=process.env.EMAILJS_SERVICE_ID!.trim();
 const templateId=process.env.EMAILJS_TEMPLATE_ID!.trim();
 const publicKey=process.env.EMAILJS_PUBLIC_KEY!.trim();
 const privateKey=process.env.EMAILJS_PRIVATE_KEY!.trim();
 const fromName=process.env.EMAILJS_FROM_NAME?.trim()||"Gasolinera Río Tempisque";

 const res=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({
   service_id:serviceId,
   template_id:templateId,
   user_id:publicKey,
   accessToken:privateKey,
   template_params:{
    to_email:payload.toEmail,
    to_name:payload.toName,
    from_name:fromName,
    subject:payload.subject,
    period:payload.period,
    net_pay:payload.netPay,
    message_html:payload.html,
    message:payload.text,
   },
  }),
 });

 if(!res.ok){
  const body=await res.text().catch(()=>"");
  throw new Error(body||`EmailJS respondió ${res.status}`);
 }
}
