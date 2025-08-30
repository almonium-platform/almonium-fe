import 'stream-chat';
import type { DefaultAttachmentData, DefaultChannelData } from 'stream-chat-angular';


declare module 'stream-chat' {
  interface CustomChannelData extends DefaultChannelData {
    name?: string;
    hidden?: boolean;
  }

  interface CustomAttachmentData extends DefaultAttachmentData {}
}
