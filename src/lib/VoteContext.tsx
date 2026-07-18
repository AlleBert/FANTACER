'use client';

import React, { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';

export interface SelectedCompany {
  company: { id: string; name: string };
  pallet: 4 | 2 | 1;
}

export interface VoteState {
  selectedCompanies: SelectedCompany[];
  currentSection: 1 | 2;
  gameUnlock: {
    submit: boolean;
    success: boolean;
  };
}

type VoteAction =
  | { type: 'SET_COMPANY'; payload: { company: { id: string; name: string }; pallet: 4 | 2 | 1 } }
  | { type: 'REMOVE_COMPANY'; payload: number }
  | { type: 'SET_PALLET'; payload: { index: number; pallet: 4 | 2 | 1 } }
  | { type: 'UNLOCK_GAME_STEP'; payload: keyof VoteState['gameUnlock'] }
  | { type: 'RESET' };

const initialState: VoteState = {
  selectedCompanies: [],
  currentSection: 1,
  gameUnlock: {
    submit: false,
    success: false,
  },
};

function voteReducer(state: VoteState, action: VoteAction): VoteState {
  switch (action.type) {
    case 'SET_COMPANY':
      if (state.selectedCompanies.length >= 3) return state;
      return { ...state, selectedCompanies: [...state.selectedCompanies, action.payload] };
    case 'REMOVE_COMPANY':
      return {
        ...state,
        selectedCompanies: state.selectedCompanies.filter((_, i) => i !== action.payload),
      };
    case 'SET_PALLET':
      return {
        ...state,
        selectedCompanies: state.selectedCompanies.map((item, i) =>
          i === action.payload.index ? { ...item, pallet: action.payload.pallet } : item
        ),
      };
    case 'UNLOCK_GAME_STEP':
      return { ...state, gameUnlock: { ...state.gameUnlock, [action.payload]: true } };
    case 'RESET':
      return initialState;
    default:
      throw new Error(`Unhandled action type: ${(action as VoteAction).type}`);
  }
}

interface VoteContextType {
  selectedCompanies: VoteState['selectedCompanies'];
  currentSection: VoteState['currentSection'];
  gameUnlock: VoteState['gameUnlock'];
  setCompany: (company: { id: string; name: string }, pallet: 4 | 2 | 1) => void;
  removeCompany: (index: number) => void;
  setPallet: (index: number, pallet: 4 | 2 | 1) => void;
  unlockGameStep: (step: keyof VoteState['gameUnlock']) => void;
  resetVote: () => void;
  usedPallets: () => (4 | 2 | 1)[];
}

const VoteContext = createContext<VoteContextType | undefined>(undefined);

export function VoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(voteReducer, initialState);

  const value = useMemo<VoteContextType>(() => ({
    selectedCompanies: state.selectedCompanies,
    currentSection: state.currentSection,
    gameUnlock: state.gameUnlock,
    setCompany: (company, pallet) => dispatch({ type: 'SET_COMPANY', payload: { company, pallet } }),
    removeCompany: (index) => dispatch({ type: 'REMOVE_COMPANY', payload: index }),
    setPallet: (index, pallet) => dispatch({ type: 'SET_PALLET', payload: { index, pallet } }),
    unlockGameStep: (step) => dispatch({ type: 'UNLOCK_GAME_STEP', payload: step }),
    resetVote: () => dispatch({ type: 'RESET' }),
    usedPallets: () => state.selectedCompanies.map((c) => c.pallet),
  }), [state]);

  return <VoteContext.Provider value={value}>{children}</VoteContext.Provider>;
}

export function useVote(): VoteContextType {
  const context = useContext(VoteContext);
  if (!context) {
    throw new Error('useVote must be used within a VoteProvider');
  }
  return context;
}
