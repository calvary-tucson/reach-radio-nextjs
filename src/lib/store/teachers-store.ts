import { create } from 'zustand'

export interface TeacherListEntry {
  name: string
  photo: string
}

interface TeachersState {
  teachersList: TeacherListEntry[]
  setTeachersList: (list: TeacherListEntry[]) => void
}

export const useTeachersStore = create<TeachersState>((set) => ({
  teachersList: [],
  setTeachersList: (list) => set({ teachersList: list }),
}))
