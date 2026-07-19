import {inject, Injectable} from '@angular/core';
import {getDownloadURL, listAll, ref, Storage, uploadBytesResumable} from '@angular/fire/storage';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private storage = inject(Storage);

  public uploadFile(file: File, folderPath: string): Promise<string> {
    const uniqueFileName = crypto.randomUUID();
    const path = `${folderPath}/${uniqueFileName}`;

    const storageRef = ref(this.storage, path);
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref); // Ensure the file is uploaded
            resolve(url);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  public async getDefaultAvatars(path: string): Promise<string[]> {
    const listRef = ref(this.storage, path);
    try {
      const result = await listAll(listRef);
      return await Promise.all(
        result.items.map(async (itemRef) => {
          return await getDownloadURL(itemRef);
        })
      );
    } catch (error) {
      console.error('Error fetching default avatars:', error);
      return [];
    }
  }
}
