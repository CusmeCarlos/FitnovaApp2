export interface Profile {
    uid: string;
    personalInfo: {
      age?: number;
      gender?: string;
      weight?: number;
      height?: number;
    };
    medicalHistory: {
      injuries?: string[];
      conditions?: string[];
      limitations?: string[];
    };
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
    goals?: string[];
    profileComplete: boolean;
  }