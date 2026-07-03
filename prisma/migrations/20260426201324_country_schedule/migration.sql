-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "outboundWeekday" INTEGER,
ADD COLUMN     "outboundTime" TEXT,
ADD COLUMN     "outboundDurationHours" DOUBLE PRECISION,
ADD COLUMN     "returnWeekday" INTEGER,
ADD COLUMN     "returnTime" TEXT,
ADD COLUMN     "returnDurationHours" DOUBLE PRECISION;
