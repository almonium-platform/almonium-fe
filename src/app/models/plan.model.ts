export interface PlanDto {
  id: string;
  name: string;
  type: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  description: string;
  price: number;
}
