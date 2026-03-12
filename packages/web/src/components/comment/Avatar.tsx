import { cn } from '../../lib/utils';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'normal' | 'small';
}

export function Avatar({ name, avatarUrl, size = 'normal' }: AvatarProps) {
  const isSmall = size === 'small';
  
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          isSmall ? 'w-5 h-5' : 'w-8 h-8',
          'rounded-full object-cover shrink-0 border border-gray-100'
        )}
      />
    );
  }
  
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  
  return (
    <div className={cn(
      isSmall ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-sm',
      'rounded-full flex items-center justify-center text-white font-medium shrink-0',
      color
    )}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}