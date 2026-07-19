import 'stream-chat';
import type {DefaultChannelData} from 'stream-chat-angular';


declare module 'stream-chat' {
  interface CustomChannelData extends DefaultChannelData {
    name?: string;
    hidden?: boolean;
  }
}
