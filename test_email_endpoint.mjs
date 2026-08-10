const url = 'https://emp-backend-2cqj.onrender.com/api/debug/smtp-test';

async function check() {
  try {
    const r = await fetch(url);
    const text = await r.text();
    console.log('Status:', r.status);
    try {
      console.log('JSON Response:', JSON.stringify(JSON.parse(text), null, 2));
    } catch (err) {
      console.log('Text Response:', text.substring(0, 500));
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

check();
