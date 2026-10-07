import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/rules')({beforeLoad:()=>{throw redirect({to:'/tenders'});}});
