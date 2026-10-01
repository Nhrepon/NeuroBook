import { Pressable, Text } from 'react-native'

interface ButtonProps {
  title: string
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
  onPress?: () => void
}

export function Button({ title, variant = 'primary', loading, disabled, onPress }: ButtonProps) {
  const palette = {
    primary: 'bg-black text-white',
    secondary: 'bg-white text-black border border-gray-300',
    danger: 'bg-white text-red-600 border border-red-300',
  }[variant]

  const textColor =
    variant === 'primary' ? 'text-white' : variant === 'danger' ? 'text-red-600' : 'text-black'

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      className={`items-center rounded px-4 py-2 active:opacity-80 disabled:opacity-50 ${palette}`}
    >
      <Text className={textColor}>{loading ? '...' : title}</Text>
    </Pressable>
  )
}
