'use client'

import { useEffect, useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import CategoryForm from './CategoryForm'
import CategoryList, { type CategoryRow } from './CategoryList'

type FormState = { mode: 'create' } | { mode: 'edit'; category: CategoryRow }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [form, setForm] = useState<FormState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/categories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load categories')
      const json = await res.json()
      setCategories(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'product:write') : true

  function openCreate() {
    if (!canWrite) return
    setError(null)
    setNotice(null)
    setForm({ mode: 'create' })
  }

  function openEdit(category: CategoryRow) {
    setError(null)
    setNotice(null)
    setForm({ mode: 'edit', category })
  }

  async function remove(category: CategoryRow) {
    const count = category.productCount
    const children = categories.filter((c) => c.parentId === category.id).length
    const effects: string[] = []
    if (count > 0) effects.push(`${count} product${count === 1 ? '' : 's'} will keep their history but lose this category`)
    if (children > 0) effects.push(`${children} sub-categor${children === 1 ? 'y' : 'ies'} will move to the top level`)
    const msg = `Delete "${category.name}"?${effects.length ? ` ${effects.join(' and ')}.` : ''}`
    if (!window.confirm(msg)) return

    setDeletingId(category.id)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/v1/categories?id=${encodeURIComponent(category.id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not delete the category.')
        return
      }
      const moved = body?.data?.products ?? count
      setNotice(
        moved > 0
          ? `Deleted "${category.name}". ${moved} product${moved === 1 ? '' : 's'} are now uncategorised.`
          : `Deleted "${category.name}".`,
      )
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const editingCategory = form?.mode === 'edit' ? form.category : null

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        icon={Tags}
        title="Product categories"
        description="Groups used to organise products and filter the product list. A category can be renamed or removed without touching a product's history."
      >
        <Button type="button" onClick={openCreate} disabled={!canWrite}>
          <Plus size={15} aria-hidden />
          New category
        </Button>
      </PageHeader>

      {role && !canWrite && <RoleNotice>Your role can view categories but not change them.</RoleNotice>}

      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && <FormAlert message={error} />}

      <CategoryList
        categories={categories}
        loading={loading}
        canWrite={canWrite}
        deletingId={deletingId}
        onEdit={openEdit}
        onDelete={remove}
      />

      {form && (
        <Modal
          title={form.mode === 'create' ? 'New category' : `Rename "${form.category.name}"`}
          subtitle={
            form.mode === 'create'
              ? 'Group related products under one name.'
              : 'Renaming keeps every product in this category.'
          }
          size="xl"
          onClose={() => setForm(null)}
        >
          <CategoryForm
            category={editingCategory}
            categories={categories}
            onCancel={() => setForm(null)}
            onSaved={(name, created) => {
              setForm(null)
              setNotice(created ? `Category "${name}" added.` : `Renamed to "${name}".`)
              void load()
            }}
          />
        </Modal>
      )}
    </main>
  )
}