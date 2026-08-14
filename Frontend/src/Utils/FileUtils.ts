import { sendMessageToBackend } from './MessageUtils';
import { ContentType } from '../Models/types';

export const openFileLocation = (filePath: string) => {
  if (!filePath) return;
  sendMessageToBackend('OpenFileLocation', { FilePath: filePath });
};

export const contentTypeToFolderName = (type: ContentType): string => {
  switch (type) {
    case 'Session':
      return 'Full Sessions';
    case 'Buffer':
      return 'Replay Buffers';
    case 'Clip':
      return 'Clips';
    case 'Lowlight':
      return 'Lowlights';
    default:
      return 'Highlights';
  }
};
