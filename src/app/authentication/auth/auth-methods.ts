import {User} from 'firebase/auth';
import {AuthMethod} from './auth.types';

export function authMethodsFromFirebaseUser(user: User): AuthMethod[] {
  return user.providerData.map(provider => ({
    provider: provider.providerId === 'password' ? 'local' : provider.providerId.replace('.com', ''),
    email: (provider.email ?? user.email) ?? '',
  }));
}
