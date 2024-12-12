import {inject, Injectable} from '@angular/core';
import {getDownloadURL, ref, Storage, uploadBytesResumable} from '@angular/fire/storage';

@Injectable({
  providedIn: 'root',
})
export class FileUploadService {
  private storage = inject(Storage);

  public uploadFile(file: File, path: string): Promise<string> {
    const storageRef = ref(this.storage, path);
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }
}
