const success = (res, data, message = 'OK', code = 200) =>
  res.status(code).json({ status: 'success', message, data });

const paginated = (res, data, meta) =>
  res.status(200).json({ status: 'success', data, meta });

const error = (res, message = 'Internal Server Error', code = 500, errors = null) => {
  const body = { status: 'error', message };
  if (errors) body.errors = errors;
  return res.status(code).json(body);
};

module.exports = { success, paginated, error };
