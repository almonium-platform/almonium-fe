import {SOCIAL_COPY} from './social-copy';

export const EN_CODE = 'eng';

export const STREAM_CHAT_TRANSLATIONS = {
  '1 reply': $localize`1 reply`,
  'Attach files': $localize`Attach files`,
  Cancel: $localize`Cancel`,
  'Channel Missing': $localize`Channel Missing`,
  Close: $localize`Close`,
  'Close emoji picker': $localize`Close emoji picker`,
  'Commands matching': $localize`Commands matching`,
  'Connection failure, reconnecting now...':
    $localize`Connection failure, reconnecting now...`,
  Delete: $localize`Delete`,
  Delivered: $localize`Delivered`,
  'Edit Message': $localize`Edit`,
  'Edit message request failed': $localize`Edit message request failed`,
  'Emoji matching': $localize`Emoji matching`,
  'Empty message...': $localize`Empty message...`,
  'Error adding flag': $localize`Error adding flag`,
  'Error connecting to chat, refresh the page to try again.':
    $localize`Error connecting to chat, refresh the page to try again`,
  'Error deleting message': $localize`Error deleting message`,
  'Error loading reactions': $localize`Error loading reactions`,
  'Error muting a user ...': $localize`Error muting a user ...`,
  'Error pinning message': $localize`Error pinning message`,
  'Error removing message pin': $localize`Error removing message pin`,
  'Error unmuting a user ...': $localize`Error unmuting a user ...`,
  'Error uploading file': $localize`Error uploading file "{{ name }}"`,
  'Error uploading file, maximum file size exceeded':
    $localize`Error uploading "{{ name }}", maximum file size {{ limit }} exceeded`,
  'Error uploading file, extension not supported':
    $localize`Error uploading "{{ name }}", type {{ ext }} not supported`,
  'Error deleting attachment': $localize`Error deleting attachment`,
  'Error · Unsent': $localize`Message couldn't be sent`,
  'Error: {{ errorMessage }}': $localize`Error: {{ errorMessage }}`,
  Flag: $localize`Flag`,
  'Message Failed': $localize`Message Failed`,
  // 10: the two failure strings the SDK renders are the same two this section renders itself,
  // so both read from the one table rather than being kept in step by hand.
  'Message Failed · Unauthorized': SOCIAL_COPY.sendRefused,
  'Message Failed · Click to try again': SOCIAL_COPY.sendFailed,
  'Message deleted': $localize`Message deleted`,
  'Message has been successfully flagged':
    $localize`Message has been successfully flagged`,
  'Message pinned': $localize`Message pinned`,
  'Message unpinned': $localize`Message unpinned`,
  Mute: $localize`Mute`,
  New: $localize`New`,
  'New Messages!': $localize`New Messages!`,
  'No results found': $localize`No results found`,
  'Nothing yet...': $localize`No messages yet`,
  'Only visible to you': $localize`Only visible to you`,
  'Open emoji picker': $localize`Open emoji picker`,
  'People matching': $localize`People matching`,
  'Pick your emoji': $localize`Pick your emoji`,
  Pin: $localize`Pin`,
  'Pinned by': $localize`Pinned by`,
  Reply: $localize`Reply`,
  'Reply to Message': $localize`Reply`,
  Search: $localize`Search`,
  'Searching...': $localize`Searching...`,
  Send: $localize`Send`,
  'Send message request failed': $localize`Send message request failed`,
  'Sending...': $localize`Sending...`,
  'Slow Mode ON': $localize`Slow Mode ON`,
  'Start of a new thread': $localize`Start of a new thread`,
  'This message was deleted...': $localize`This message was deleted...`,
  Thread: $localize`Thread reply`,
  'Type your message': $localize`Write a message`,
  Unmute: $localize`Unmute`,
  Unpin: $localize`Unpin`,
  'Wait until all attachments have uploaded':
    $localize`Wait until all attachments have uploaded`,
  'You have no channels currently': $localize`No chats yet`,
  "You've reached the maximum number of files":
    $localize`You've reached the maximum number of files`,
  live: $localize`live`,
  'this content could not be displayed':
    $localize`this content could not be displayed`,
  '{{ commaSeparatedUsers }} and {{ moreCount }} more':
    $localize`{{ commaSeparatedUsers }} and {{ moreCount }} more`,
  '{{ commaSeparatedUsers }}, and {{ lastUser }}':
    $localize`{{ commaSeparatedUsers }}, and {{ lastUser }}`,
  '{{ firstUser }} and {{ secondUser }}':
    $localize`{{ firstUser }} and {{ secondUser }}`,
  '{{ imageCount }} more': $localize`{{ imageCount }} more`,
  '{{ memberCount }} members': $localize`{{ memberCount }} members`,
  '{{ replyCount }} replies': $localize`{{ replyCount }} replies`,
  '{{ user }} has been muted': $localize`{{ user }} has been muted`,
  '{{ user }} has been unmuted': $localize`{{ user }} has been unmuted`,
  '{{ watcherCount }} online': $localize`{{ watcherCount }} online`,
  '🏙 Attachment...': $localize`Attachment...`,
  'Connection error': $localize`Connection error`,
  'Load more': $localize`Load more`,
  failed: $localize`failed`,
  retry: $localize`retry`,
  test: $localize`success`,
  'Sending links is not allowed in this conversation':
    $localize`Sending links is not allowed in this conversation`,
  "You can't send messages in this channel":
    $localize`Only Almonium posts in this channel`,
  "You can't send thread replies in this channel":
    $localize`You can't send thread replies in this channel`,
  'Message not found': $localize`Message not found`,
  'No chats here yet…': $localize`Select a chat to start messaging`,
  'user is typing': $localize`{{ user }} is typing`,
  'users are typing': $localize`{{ users }} are typing`,
  'Error loading channels': $localize`Error loading channels`,
  'See original (automatically translated)':
    $localize`See original (automatically translated)`,
  'See translation': $localize`See translation`,
  'Mark as unread': $localize`Mark as unread from here`,
  'Error marking message as unread': $localize`Error marking message as unread`,
  'Error, only the first {{count}} message can be marked as unread':
    $localize`Error, only the first {{count}} message can be marked as unread`,
  'Unread messages': $localize`Unread messages`,
  '{{count}} unread messages': $localize`{{count}} unread messages`,
  '{{count}} unread message': $localize`{{count}} unread message`,
  'This message did not meet our content guidelines':
    $localize`This message did not meet our content guidelines`,
  'Send Anyway': $localize`Send Anyway`,
  Edited: $localize`Edited`,
  'Error playing audio': $localize`Error playing audio`,
  'Copy text': $localize`Copy text`,
  'Please grant permission to use microhpone':
    $localize`Please grant permission to use microhpone`,
  'Error starting recording': $localize`Error starting recording`,
  'An error has occurred during recording':
    $localize`An error has occurred during recording`,
  'Media recording not supported': $localize`Media recording not supported`,
  "You can't uplod more than {{max}} attachments":
    $localize`You can't uplod more than {{max}} attachments`,
  'You currently have {{count}} attachments, the maximum is {{max}}':
    $localize`You currently have {{count}} attachments, the maximum is {{max}}`,
  'and others': $localize`and others`,
};
