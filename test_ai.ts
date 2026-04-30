import { processIncomingMessage } from './src/lib/ai-agent';

async function run() {
  console.log('Testing AI...');
  const res = await processIncomingMessage('ازيك عامل ايه', 'bbd71d55-7c8d-4d5f-97f4-8854ac796807', [], '201115351111');
  console.log('AI Response:', res);
}

run();
