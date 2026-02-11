import { create } from 'zustand';

export interface Letter {
  id: string;
  title: string;
  body: string;
  date: string;
  deliveryDate: string;
  signature: string;
  recipientEmail?: string;
  recipientType: 'myself' | 'someone';
  photos: string[];
  sketchData?: string;
  isTyped: boolean;
  createdAt: string;
  type: 'sent' | 'received';
}

// Mock data with past and future delivery dates
const mockLetters: Letter[] = [
  {
    id: '1',
    title: 'A note to my future self',
    body: 'Dear future me,\n\nI hope you\'re doing well and that life has been kind to you. Remember to always chase your dreams and never give up on what matters most. Take care of yourself and the people you love.\n\nWith hope and love,\nPast you ✨',
    date: '2024-12-01',
    deliveryDate: '2025-01-01',
    signature: 'With love',
    recipientType: 'myself',
    photos: [],
    isTyped: true,
    createdAt: '2024-12-01T10:00:00Z',
    type: 'sent',
  },
  {
    id: '2',
    title: 'Birthday wishes 🎂',
    body: 'Happy Birthday to the most amazing person I know! 🎉\n\nI wrote this months ago just so you\'d have something special waiting for you today. I hope your day is filled with joy, laughter, and all the cake you can eat!\n\nCelebrate yourself today! 🦋',
    date: '2024-11-15',
    deliveryDate: '2025-01-10',
    signature: 'Your biggest fan',
    recipientType: 'myself',
    photos: [],
    isTyped: true,
    createdAt: '2024-11-15T14:30:00Z',
    type: 'sent',
  },
  {
    id: '3',
    title: 'A promise to remember',
    body: 'This is a reminder of the promise you made to yourself. Stay strong, keep believing, and never forget why you started this journey. You\'ve got this! 🌟',
    date: '2025-01-05',
    deliveryDate: '2026-06-15',
    signature: 'Stay hopeful',
    recipientType: 'myself',
    photos: [],
    isTyped: true,
    createdAt: '2025-01-05T09:00:00Z',
    type: 'sent',
  },
  {
    id: '4',
    title: 'Gratitude note 🌸',
    body: 'Today I\'m grateful for:\n\n• The warm sunshine\n• A good cup of tea\n• The people who make life beautiful\n• This moment of peace\n\nMay you always find reasons to be thankful. 🕊️',
    date: '2024-10-20',
    deliveryDate: '2025-01-12',
    signature: 'Gratefully yours',
    recipientType: 'myself',
    photos: [],
    isTyped: true,
    createdAt: '2024-10-20T16:45:00Z',
    type: 'sent',
  },
];

interface LetterStore {
  letters: Letter[];
  addLetter: (letter: Letter) => void;
  getLetterById: (id: string) => Letter | undefined;
  isLetterOpenable: (letter: Letter) => boolean;
}

export const useLetterStore = create<LetterStore>((set, get) => ({
  letters: mockLetters,
  
  addLetter: (letter) => set((state) => ({ 
    letters: [...state.letters, letter] 
  })),
  
  getLetterById: (id) => {
    return get().letters.find(l => l.id === id);
  },
  
  isLetterOpenable: (letter) => {
    const deliveryDate = new Date(letter.deliveryDate);
    const now = new Date();
    return now >= deliveryDate;
  },
}));
