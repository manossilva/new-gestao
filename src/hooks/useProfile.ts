import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user, refreshProfile } = useAuth()
  const [uploading, setUploading] = useState(false)

  const updateProfile = async (updates: Record<string, string | null | undefined>) => {
    if (!user) return { error: new Error('Not authenticated') }
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (!error) await refreshProfile()
    return { error }
  }

  const uploadPhoto = async (file: File) => {
    if (!user) return { error: new Error('Not authenticated'), url: null }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) return { error: uploadError, url: null }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return { error: null, url: data.publicUrl }
    } finally {
      setUploading(false)
    }
  }

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  return { updateProfile, uploadPhoto, uploading, changePassword }
}
