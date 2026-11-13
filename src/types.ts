export type UserRole = 'customer' | 'supplier' | 'petani_kelor' | 'supplier_bsf' | 'admin' | 'distributor';

export type ActiveTab =
  | 'home'
  | 'market'
  | 'chain'
  | 'edu'
  | 'supply'
  | 'production'
  | 'quality'
  | 'admin'
  | 'distributor'
  | 'profile';

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  avatar_url: string;
  leaderboard_anonymous: number;
  points_total: number;
  points_available: number;
  points_redeemed: number;
  level_id: number;
  level_number?: number;
  level_name?: string;
  min_points?: number;
  is_simulation?: number;
}

export interface VoucherCode {
  id: number;
  code: string;
  reward_id: number;
  reward_title: string;
  reward_type: 'free_shipping' | 'discount_fixed';
  discount_amount: number;
  max_subsidy: number;
  min_purchase: number;
  expires_at: string;
  is_used: number;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: number;
  created_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  profile: UserProfile;
  badges?: Array<{ id: number; badge_code: string; badge_name: string; description: string; earned_at: string }>;
  vouchers?: VoucherCode[];
  notifications?: NotificationItem[];
}

export interface ProductBundle {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  quantity_units: number;
  normal_price: number;
  bundle_price: number;
  discount_amount: number;
  description: string;
  sort_order: number;
}

export interface CartItem {
  bundle: ProductBundle;
  quantity: number;
}
