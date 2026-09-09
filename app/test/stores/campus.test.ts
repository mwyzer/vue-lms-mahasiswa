/**
 * Campus Store & Multi-campus Helpers — Unit Tests
 *
 * Tests the pure campus helpers and the campus store
 * (init, selection, CRUD, per-campus counts) in demo mode.
 */
import { describe, it, expect } from 'vitest'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import {
  useCampusStore,
  DEMO_CAMPUSES,
  campusIdForUser,
  courseCampusId,
  campusNameOf,
  filterByCampus,
  demoUserCampusResolver,
  demoCourseCampusResolver,
  rosterCampusResolver,
  courseRowCampusResolver,
} from '~/stores/campus'

describe('campus pure helpers', () => {
  it('resolves demo users to their campus', () => {
    expect(campusIdForUser('i1')).toBe('camp-utama')
    expect(campusIdForUser('i2')).toBe('camp-satelit')
    expect(campusIdForUser('i3')).toBe('camp-utama')
    expect(campusIdForUser('s1')).toBe('camp-utama')
    expect(campusIdForUser('s9')).toBe('camp-satelit')
    expect(campusIdForUser('s17')).toBe('camp-satelit')
    expect(campusIdForUser('a1')).toBeNull()
    expect(campusIdForUser('unknown')).toBeNull()
  })

  it('resolves demo courses to their campus', () => {
    expect(courseCampusId('c1')).toBe('camp-utama')
    expect(courseCampusId('c8')).toBe('camp-utama')
    expect(courseCampusId('c9')).toBe('camp-satelit')
    expect(courseCampusId('c15')).toBe('camp-satelit')
    expect(courseCampusId('nope')).toBeNull()
  })

  it('looks up campus display names', () => {
    expect(campusNameOf(DEMO_CAMPUSES, 'camp-utama')).toBe('Kampus Utama')
    expect(campusNameOf(DEMO_CAMPUSES, 'camp-satelit')).toBe('Kampus Satelit')
    expect(campusNameOf(DEMO_CAMPUSES, null)).toBe('—')
    expect(campusNameOf(DEMO_CAMPUSES, undefined)).toBe('—')
    expect(campusNameOf(DEMO_CAMPUSES, 'camp-unknown')).toBe('—')
  })

  it('filters items by campus with the demo user resolver', () => {
    const students = [
      { id: 's1', nama: 'A' },
      { id: 's9', nama: 'B' },
      { id: 's17', nama: 'C' },
    ]
    expect(filterByCampus(students, 'camp-utama', demoUserCampusResolver).map((s) => s.id)).toEqual(['s1'])
    expect(filterByCampus(students, 'camp-satelit', demoUserCampusResolver).map((s) => s.id)).toEqual(['s9', 's17'])
    // null campus = no scoping
    expect(filterByCampus(students, null, demoUserCampusResolver)).toHaveLength(3)
  })

  it('filters demo courses with the course resolver', () => {
    const courses = [{ id: 'c1' }, { id: 'c9' }]
    expect(filterByCampus(courses, 'camp-utama', demoCourseCampusResolver).map((c) => c.id)).toEqual(['c1'])
    expect(filterByCampus(courses, 'camp-satelit', demoCourseCampusResolver).map((c) => c.id)).toEqual(['c9'])
  })

  it('supports Supabase row resolvers', () => {
    expect(rosterCampusResolver({ campusId: 'cam-x' })).toBe('cam-x')
    expect(rosterCampusResolver({ campusId: null })).toBeNull()
    expect(courseRowCampusResolver({ campus_id: 'cam-y' })).toBe('cam-y')
    expect(courseRowCampusResolver({})).toBeNull()
  })
})

describe('campus store (demo mode)', () => {
  it('initializes with two demo campuses', async () => {
    const store = useCampusStore()
    await store.init()

    expect(store.isDemoMode).toBe(true)
    expect(store.initialized).toBe(true)
    expect(store.campusCount).toBe(2)
    expect(store.allCampuses.map((c) => c.kode)).toEqual(['KPU', 'KPS'])
  })

  it('selects a campus scope', async () => {
    const store = useCampusStore()
    await store.init()

    expect(store.currentCampus).toBeNull()
    store.selectCampus('camp-satelit')
    expect(store.currentCampusId).toBe('camp-satelit')
    expect(store.currentCampus?.nama).toBe('Kampus Satelit')

    store.selectCampus(null)
    expect(store.currentCampus).toBeNull()
  })

  it('adds a campus and rejects empty or duplicate kode', async () => {
    const store = useCampusStore()
    await store.init()

    const ok = await store.addCampus({ kode: 'KPT', nama: 'Kampus Teknologi', alamat: 'Jl. Riset No. 3' })
    expect(ok).toBe(true)
    expect(store.campusCount).toBe(3)

    const bad = await store.addCampus({ kode: '', nama: '' })
    expect(bad).toBe(false)
    expect(store.error).toBeTruthy()

    const dup = await store.addCampus({ kode: 'kpu', nama: 'Duplikat' })
    expect(dup).toBe(false)
    expect(store.error).toMatch(/sudah digunakan/i)
  })

  it('updates an existing campus', async () => {
    const store = useCampusStore()
    await store.init()

    const ok = await store.updateCampus('camp-utama', { nama: 'Kampus Utama Baru', kode: 'KP1' })
    expect(ok).toBe(true)
    expect(store.allCampuses.find((c) => c.id === 'camp-utama')?.nama).toBe('Kampus Utama Baru')
    expect(store.allCampuses.find((c) => c.id === 'camp-utama')?.kode).toBe('KP1')

    const missing = await store.updateCampus('camp-nope', { nama: 'X' })
    expect(missing).toBe(false)
    expect(store.error).toMatch(/tidak ditemukan/i)
  })

  it('deletes a campus and clears its active scope', async () => {
    const store = useCampusStore()
    await store.init()
    store.selectCampus('camp-satelit')

    const ok = await store.deleteCampus('camp-satelit')
    expect(ok).toBe(true)
    expect(store.campusCount).toBe(1)
    expect(store.currentCampusId).toBeNull()
  })
})

describe('campusCounts (demo mode)', () => {
  it('computes per-campus headcounts from demo rosters and courses', async () => {
    await useAuthStore().init()
    await useCoursesStore().init()
    const store = useCampusStore()
    await store.init()

    const counts = store.campusCounts
    const utama = counts.find((c) => c.campusId === 'camp-utama')!
    const satelit = counts.find((c) => c.campusId === 'camp-satelit')!

    // s1..s8 → utama (8), s9..s17 → satelit (9)
    expect(utama.students).toBe(8)
    expect(satelit.students).toBe(9)

    // i1, i3 → utama (2), i2 → satelit (1)
    expect(utama.instructors).toBe(2)
    expect(satelit.instructors).toBe(1)

    // c1..c8 → utama (8), c9..c15 → satelit (7)
    expect(utama.courses).toBe(8)
    expect(satelit.courses).toBe(7)
  })
})