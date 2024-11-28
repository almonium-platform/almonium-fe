export interface PlanDto {
  id: number;
  name: string;
  type: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  description: string;
  price: number;
}
