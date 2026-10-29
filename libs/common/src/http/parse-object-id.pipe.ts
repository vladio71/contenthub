import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

/** Rejects ids that cannot be Mongo ObjectIds, so repositories never see garbage. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!OBJECT_ID_PATTERN.test(value)) {
      throw new BadRequestException('Id must be a 24 character hex string');
    }
    return value;
  }
}
