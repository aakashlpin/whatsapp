/* eslint-disable no-return-await */
import { create } from '@open-wa/wa-automate';
import axios from 'axios';
import express from 'express';

const { default: PQueue } = require('p-queue');
const queue = new PQueue({ concurrency: 2 });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4004;
const MESSAGE_HANDLER_URI = process.env.MESSAGE_HANDLER_URI || 'http://localhost:3000/api/integrations/whatsapp/subscriber';

async function fire(data) {
  await axios.post(MESSAGE_HANDLER_URI, data);
}

const wh = (event) => async (data) => {
  const ts = Date.now();
  return await queue.add(() =>
    fire({
      ts,
      event,
      data,
    }),
  );
};

async function start(client) {
  app.use(client.middleware());
  client.onAck(wh('ack'));
  client.onAnyMessage(wh('any_message'));
  client.onMessage(wh('message'));

  // requires a group id
  //   client.onParticipantsChanged(wh('message'))
  client.onAddedToGroup(wh('added_to_group'));
  client.onBattery(wh('battery'));
  client.onContactAdded(wh('contact_added'));
  client.onIncomingCall(wh('incoming_call'));
  client.onPlugged(wh('plugged'));
  client.onStateChanged(wh('state'));

  // this is only for insiders
  client.onRemovedFromGroup(wh('removed_from_group'));

  const unreadMessages = await client.getAllUnreadMessages();
  unreadMessages.forEach(wh('message'));

  app.listen(PORT, () => {
    console.log(`\n• Whatsapp Web listening on port ${PORT}!`);
    console.log(`\n• Whatsapp Web is using URI ${MESSAGE_HANDLER_URI} for message handling`);
  });
}

create({
  headless: true,
  autoRefresh: true,
  cacheEnabled: false,
  // executablePath:
  //   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  executablePath:
    'google-chrome-stable',
})
  .then(async (client) => await start(client))
  .catch((e) => {
    console.log('Error', e.message);
  });
