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

interface LetterStore {
  letters: Letter[];
  addLetter: (letter: Letter) => void;
  getLetterById: (id: string) => Letter | undefined;
  isLetterOpenable: (letter: Letter) => boolean;
}

export const useLetterStore = create<LetterStore>((set, get) => ({
  letters: [],
  
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
