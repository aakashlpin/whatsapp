/* eslint-disable no-return-await */
import { create } from '@open-wa/wa-automate';
import axios from 'axios';
import express from 'express';

const { default: PQueue } = require('p-queue');

const { PORT, MESSAGE_HANDLER_URI } = process.env;

const queue = new PQueue({ concurrency: 2 });
const app = express();
app.use(express.json());

async function fire(data) {
  try {
    await axios.post(MESSAGE_HANDLER_URI, data);
  } catch (e) {
    console.log('fire error');
    console.log(e);
  }
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
  client.onStateChanged((state) => {
    console.log('stateChanged', state);
    if (state === 'CONFLICT' || state === 'UNLAUNCHED') client.forceRefocus();
    if (state === 'UNPAIRED') console.log('LOGGED OUT!!!!');
  });

  // this is only for insiders
  client.onRemovedFromGroup(wh('removed_from_group'));

  const unreadMessages = await client.getAllUnreadMessages();
  unreadMessages.forEach(wh('message'));

  client.getPage().on('error', (e) => {
    console.log('client page error', e);
  });

  app.listen(PORT, () => {
    console.log(`\n• Whatsapp Web listening on port ${PORT}!`);
    console.log(
      `\n• Whatsapp Web is using URI ${MESSAGE_HANDLER_URI} for message handling`,
    );
  });
}

create({
  headless: true,
  autoRefresh: true,
  cacheEnabled: false,
  inDocker: true,
  // kill the process if the browser crashes/is closed manually
  killProcessOnBrowserClose: true,
  // executablePath:
  //   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  executablePath: 'google-chrome-stable',
})
  .then(async (client) => await start(client))
  .catch((e) => {
    console.log('Globally caught error', e.message);
  });
