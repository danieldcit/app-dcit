import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AdmissionDocumentInputSchema,
  AdmissionDocumentStatusUpdateSchema,
  CertificationInputSchema,
  PayslipInputSchema,
  PayslipUpdateSchema,
} from '@ponto-dcit/shared-types';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @UseGuards(AuthGuard)
  @Get('holerites')
  listPayslips(@Req() req: AuthenticatedRequest) {
    return this.documentos.listPayslips(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('holerites')
  @HttpCode(201)
  async createPayslip(@Body() body: unknown) {
    const result = PayslipInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createPayslip(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('holerites/equipe')
  listAllPayslips() {
    return this.documentos.listAllPayslips();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('holerites/:id')
  updatePayslip(@Param('id') id: string, @Body() body: unknown) {
    const result = PayslipUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.updatePayslip(id, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Delete('holerites/:id')
  @HttpCode(204)
  async removePayslip(@Param('id') id: string) {
    await this.documentos.deletePayslip(id);
  }

  @UseGuards(AuthGuard)
  @Post('admissionais')
  @HttpCode(201)
  async createAdmissionDocument(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = AdmissionDocumentInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createAdmissionDocument(req.user.sub, req.user.name, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('admissionais')
  listAdmissionDocuments(@Req() req: AuthenticatedRequest) {
    return this.documentos.listAdmissionDocuments(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('admissionais/equipe')
  listAllAdmissionDocuments() {
    return this.documentos.listAllAdmissionDocuments();
  }

  @UseGuards(AuthGuard)
  @Get('admissionais/:id/photos')
  async getAdmissionDocumentPhotos(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const photos = await this.documentos.getAdmissionDocumentPhotos(
      id,
      req.user.role,
      req.user.sub,
    );
    return { photos: photos ?? [] };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('admissionais/:id/status')
  async updateAdmissionDocumentStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = AdmissionDocumentStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.updateAdmissionDocumentStatus(
      id,
      result.data.status,
      result.data.reviewNote,
    );
  }

  @UseGuards(AuthGuard)
  @Post('certificacoes')
  @HttpCode(201)
  async createCertification(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = CertificationInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createCertification(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('certificacoes')
  listCertifications(@Req() req: AuthenticatedRequest) {
    return this.documentos.listCertifications(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('certificacoes/equipe')
  listAllCertifications() {
    return this.documentos.listAllCertifications();
  }
}
