import { create } from 'zustand';
import { PracticeSession, PracticeQuestion, PracticeConfig, WrongQuestion } from '@/types';

interface PracticeState {
  currentSession: PracticeSession | null;
  currentQuestionIndex: number;
  wrongQuestions: WrongQuestion[];
  practiceHistory: PracticeSession[];
  isLoading: boolean;

  // Actions
  startSession: (config: PracticeConfig, questions: PracticeQuestion[]) => void;
  answerQuestion: (answer: string | string[]) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  endSession: () => PracticeSession | null;
  setCurrentQuestionIndex: (index: number) => void;
  setWrongQuestions: (questions: WrongQuestion[]) => void;
  addWrongQuestion: (question: WrongQuestion) => void;
  removeWrongQuestion: (id: string) => void;
  setPracticeHistory: (history: PracticeSession[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const usePracticeStore = create<PracticeState>((set, get) => ({
  currentSession: null,
  currentQuestionIndex: 0,
  wrongQuestions: [],
  practiceHistory: [],
  isLoading: false,

  startSession: (config: PracticeConfig, questions: PracticeQuestion[]) => {
    const session: PracticeSession = {
      id: Date.now().toString(),
      userId: '',
      knowledgePointId: config.knowledgePointId,
      difficulty: config.difficulty,
      questionCount: config.questionCount,
      correctCount: 0,
      startTime: new Date().toISOString(),
      questions: questions
    };
    set({ currentSession: session, currentQuestionIndex: 0 });
  },

  answerQuestion: (answer: string | string[]) => {
    const { currentSession, currentQuestionIndex } = get();
    if (!currentSession) return;

    const questions = [...currentSession.questions];
    const question = questions[currentQuestionIndex];
    const isCorrect = Array.isArray(question.question.answer)
      ? JSON.stringify(answer.sort()) === JSON.stringify(question.question.answer.sort())
      : answer === question.question.answer;

    questions[currentQuestionIndex] = {
      ...question,
      userAnswer: answer,
      isCorrect
    };

    const correctCount = questions.filter(q => q.isCorrect).length;

    set({
      currentSession: {
        ...currentSession,
        questions,
        correctCount
      }
    });
  },

  nextQuestion: () => {
    const { currentQuestionIndex, currentSession } = get();
    if (currentSession && currentQuestionIndex < currentSession.questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  endSession: () => {
    const { currentSession } = get();
    if (currentSession) {
      const endedSession = {
        ...currentSession,
        endTime: new Date().toISOString()
      };
      set({ currentSession: null, currentQuestionIndex: 0 });
      return endedSession;
    }
    return null;
  },

  setCurrentQuestionIndex: (index: number) => {
    set({ currentQuestionIndex: index });
  },

  setWrongQuestions: (questions: WrongQuestion[]) => {
    set({ wrongQuestions: questions });
  },

  addWrongQuestion: (question: WrongQuestion) => {
    set(state => ({
      wrongQuestions: [...state.wrongQuestions, question]
    }));
  },

  removeWrongQuestion: (id: string) => {
    set(state => ({
      wrongQuestions: state.wrongQuestions.filter(q => q.id !== id)
    }));
  },

  setPracticeHistory: (history: PracticeSession[]) => {
    set({ practiceHistory: history });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  reset: () => {
    set({
      currentSession: null,
      currentQuestionIndex: 0,
      wrongQuestions: [],
      practiceHistory: [],
      isLoading: false
    });
  }
}));

export default usePracticeStore;
