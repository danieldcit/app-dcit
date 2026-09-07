-- DropColumn (Horas Trabalhadas/Extras are now derived live from ponto via
-- BancoDeHorasService — see HorasService.resumo/list — instead of being
-- stored on this row. Only the manually-logged ticket hours remain here.)
ALTER TABLE "WorkedHoursEntry" DROP COLUMN "horasTrabalhadas";
