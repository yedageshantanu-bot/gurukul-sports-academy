const fs = require('fs');
const path = require('path');
const dotenv = require('./backend/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
const apiKey = process.env.ELEVENLABS_API_KEY || 'sk_f25134f8638848ea555de0971b83fe29bfe644a002e68a60';

console.log('Generating ElevenLabs Audio Status Report...');

const scriptText = `नमस्कार सर, मी तुमचा AI इंजिनिअर बोलतोय. तुम्ही सांगितलेल्या सर्व सुधारणा आणि समस्यांचे निवारण पूर्ण झाले आहे.

पहिली गोष्ट: टूर्नामेंट मॉड्युलमधील व्हॉट्सअ‍ॅप ऑप्शन्स
क्लायंटच्या आदेशानुसार, टूर्नामेंटमधून व्हॉट्सअ‍ॅप मेसेजिंग पूर्णपणे बंद करण्यात आले आहे. आता कोणत्याही ऍथलीटला टूर्नामेंटमध्ये नामांकित करताना पालकांना कोणताही मेसेज जाणार नाही. तसेच टूर्नामेंट तयार करण्याचा आणि एडिट करण्याचा फॉर्म अत्यंत सोपा करण्यात आला आहे. यामध्ये आता फक्त टूर्नामेंटचे नाव, स्थळ, सुरुवातीची तारीख आणि शेवटची तारीख एवढेच पर्याय ठेवले आहेत. डेडलाइन आणि नियमांचे सर्व अनावश्यक टेक्स्टबॉक्सेस काढून टाकले आहेत.

दुसरी सर्वात महत्त्वाची गोष्ट: शेड्युल केलेले अनाउन्समेंट मेसेजेस
शेड्युल केलेले मेसेजेस का जात नव्हते, याचे मूळ कारण शोधून त्याचे पूर्ण निवारण केले आहे. जुने अडकलेले टेस्ट मेसेजेस आधी संपूर्ण क्यू ब्लॉक करत होते. आता बॅकग्राउंड वर्कर आणि शेड्युलर पूर्णपणे अपडेट केले आहेत, ज्यामुळे ठरवलेल्या वेळेवर मेसेज अचूक निघून जातील.
याशिवाय अनाउन्समेंट विभागात शेड्युल मेसेजेससाठी एक नवीन स्वतंत्र पेज तयार केले आहे. येथे तुम्हाला सर्व नियोजित मेसेजेस, त्यांची पाठवण्याची तारीख व वेळ, विद्यार्थ्यांची संख्या आणि स्टेटस दिसेल. या पेजवरून तुम्ही कधीही मेसेज एडिट करू शकता, रद्द करू शकता किंवा सेंड नाऊ बटण दाबून त्वरित पाठवू शकता. तसेच व्हॉट्सअ‍ॅप क्यूआर कनेक्टेड आहे की नाही, याचा लाईव्ह स्टेटस इंडिकेटरही या पेजवर जोडला आहे.

सर्व सिस्टिम, डिझाइन, आधुनिक फॉन्ट आणि डेटाबेस पूर्णपणे टेस्ट करून व्हेरिफाय केले आहेत. धन्यवाद!`;

async function main() {
  const voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // George - Warm, Multilingual
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: scriptText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('ElevenLabs API Error:', response.status, err);
    process.exit(1);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outputPath = path.join(__dirname, 'elevenlabs_gurukul_status_report.mp3');
  fs.writeFileSync(outputPath, buffer);
  console.log(`ElevenLabs Audio Report successfully generated: ${outputPath} (${buffer.length} bytes)`);
}

main().catch(console.error);
