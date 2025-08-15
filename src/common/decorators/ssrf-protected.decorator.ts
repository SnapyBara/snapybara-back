import { UseGuards } from '@nestjs/common';
import { SsrfGuard } from '../guards/ssrf.guard';

export const SsrfProtected = () => UseGuards(SsrfGuard);
