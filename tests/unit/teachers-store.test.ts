import { describe, it, expect, beforeEach } from 'vitest'
import { useTeachersStore } from '@/lib/store/teachers-store'

describe('useTeachersStore', () => {
  beforeEach(() => {
    useTeachersStore.setState({ teachersList: [] })
  })

  it('setTeachersList updates teachersList', () => {
    const list = [
      { name: 'Alice', photo: 'https://example.com/alice.jpg' },
      { name: 'Bob', photo: 'https://example.com/bob.jpg' },
    ]
    useTeachersStore.getState().setTeachersList(list)
    expect(useTeachersStore.getState().teachersList).toEqual(list)
  })

  it('teachersList defaults to empty array', () => {
    useTeachersStore.setState({ teachersList: [] })
    expect(useTeachersStore.getState().teachersList).toEqual([])
  })
})
