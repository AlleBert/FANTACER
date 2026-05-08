'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export type Adjective = 'eccezionale' | 'migliore' | 'nella media' | 'peggiore' | null;

export interface VoteState {
  selectedCompany: { id: string; name: string } | null;
  comment: string;
  adjective: Adjective;
  sliders: {
    innovation: number;
    sales: number;
    wow: number;
  };
  currentSection: 1 | 2 | 3 | 4;
}

type VoteAction =
  | { type: 'SET_COMPANY'; payload: { id: string; name: string } | null }
  | { type: 'SET_COMMENT'; payload: string }
  | { type: 'SET_ADJECTIVE'; payload: Adjective }
  | { type: 'SET_SLIDER'; payload: { key: keyof VoteState['sliders']; value: number } }
  | { type: 'SET_SECTION'; payload: VoteState['currentSection'] }
  | { type: 'RESET' };

const initialState: VoteState = {
  selectedCompany: null,
  comment: '',
  adjective: null,
  sliders: { innovation: 50, sales: 50, wow: 50 },
  currentSection: 1,
};

function voteReducer(state: VoteState, action: VoteAction): VoteState {
  switch (action.type) {
    case 'SET_COMPANY':
      return { ...state, selectedCompany: action.payload };
    case 'SET_COMMENT':
      return { ...state, comment: action.payload };
    case 'SET_ADJECTIVE':
      return { ...state, adjective: action.payload };
    case 'SET_SLIDER':
      return {
        ...state,
         sliders: { ...state.sliders, [action.payload.key]: Math.min(100, Math.max(0, action.payload.value)) },
      };
    case 'SET_SECTION':
      return { ...state, currentSection: action.payload };
    case 'RESET':
      return initialState;
     default:
       throw new Error(`Unhandled action type: ${(action as VoteAction).type}`);
  }
}

interface VoteContextType {
  selectedCompany: VoteState['selectedCompany'];
  comment: string;
  adjective: Adjective;
  sliders: VoteState['sliders'];
  currentSection: VoteState['currentSection'];
  setSelectedCompany: (company: { id: string; name: string } | null) => void;
  setComment: (comment: string) => void;
  setAdjective: (adj: Adjective) => void;
  setSlider: (key: keyof VoteState['sliders'], value: number) => void;
  setCurrentSection: (section: VoteState['currentSection']) => void;
  resetVote: () => void;
}

const VoteContext = createContext<VoteContextType | undefined>(undefined);

export function VoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(voteReducer, initialState);

  const value: VoteContextType = {
    selectedCompany: state.selectedCompany,
    comment: state.comment,
    adjective: state.adjective,
    sliders: state.sliders,
    currentSection: state.currentSection,
    setSelectedCompany: (company) => dispatch({ type: 'SET_COMPANY', payload: company }),
    setComment: (comment) => dispatch({ type: 'SET_COMMENT', payload: comment }),
    setAdjective: (adj) => dispatch({ type: 'SET_ADJECTIVE', payload: adj }),
    setSlider: (key, value) => dispatch({ type: 'SET_SLIDER', payload: { key, value } }),
    setCurrentSection: (section) => dispatch({ type: 'SET_SECTION', payload: section }),
    resetVote: () => dispatch({ type: 'RESET' }),
  };

  return <VoteContext.Provider value={value}>{children}</VoteContext.Provider>;
}

export function useVote(): VoteContextType {
  const context = useContext(VoteContext);
  if (!context) {
    throw new Error('useVote must be used within a VoteProvider');
  }
  return context;
}
