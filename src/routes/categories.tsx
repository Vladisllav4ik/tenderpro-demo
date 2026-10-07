import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/categories')({beforeLoad:()=>{throw redirect({to:'/tenders'});}});
